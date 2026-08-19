import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Local-filesystem image storage under `public/uploads/`.
 *
 * Why local disk rather than S3/Vercel Blob/Cloudinary: this project has no
 * existing storage-provider configuration anywhere (no SDK in
 * package.json, no bucket/API-key env vars in .env.example, and
 * next.config.mjs's `images.remotePatterns` was still empty with a comment
 * saying so "once uploads are wired up" — never actually wired). Every
 * image in the app is already rendered with a plain `<img>` tag (see
 * ProductCard/AuctionCard), not `next/image`, so there's no remote-pattern
 * allowlist to maintain either way. Writing validated files straight into
 * `public/uploads/` and storing the resulting `/uploads/<file>` path in
 * `Product.images` (already a `String[]`, unchanged) is the smallest
 * change that satisfies "select files, no manual URLs" without adding a
 * paid third-party account this project never asked for.
 *
 * Trade-off worth flagging: this assumes a persistent filesystem (a normal
 * `next start` Node server, or any host with a durable disk/volume). It
 * will NOT persist uploads on ephemeral/serverless hosts (e.g. Vercel's
 * default deployment) since `public/` is not writable/durable there. If
 * this app is later deployed to a platform like that, swap this file's
 * internals for an S3/Blob client — every caller only depends on
 * `saveUploadedImages(files) => string[]`, so that swap doesn't touch any
 * action or component.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads";

/** Maps an accepted MIME type to the file extension we write to disk. */
const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB per file
export const MAX_IMAGES_PER_PRODUCT = 6;

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

/**
 * Magic-byte signatures for each accepted type. The browser-supplied
 * `File.type` is just the client's Content-Type guess and is trivially
 * spoofable (rename a .html file to .jpg), so it is never trusted alone —
 * this checks the actual leading bytes of the uploaded content, matching
 * the "validate uploads server-side, don't trust client-side validation
 * alone" requirement.
 */
function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  const signature: number[] | undefined = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "image/gif": [0x47, 0x49, 0x46, 0x38],
    // WEBP is a RIFF container ("RIFF" .... "WEBP"); check both markers.
    "image/webp": [0x52, 0x49, 0x46, 0x46],
  }[mimeType];

  if (!signature) return false;
  const headMatches = signature.every((byte, i) => buffer[i] === byte);
  if (!headMatches) return false;

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return true;
}

/**
 * Validates and persists a batch of uploaded image files, returning the
 * public paths (e.g. `/uploads/<uuid>.jpg`) to store in `Product.images`.
 *
 * Throws `InvalidImageError` (safe to surface to the user as a field
 * error) on the first file that fails type/size/signature validation, or
 * if the batch exceeds `MAX_IMAGES_PER_PRODUCT`. Callers that also allow
 * keeping previously-uploaded images (edit forms) should account for that
 * existing count themselves before calling this, so the *combined* total
 * never exceeds the limit.
 */
export async function saveUploadedImages(files: File[]): Promise<string[]> {
  const real = files.filter((file) => file instanceof File && file.size > 0);
  if (real.length === 0) return [];

  if (real.length > MAX_IMAGES_PER_PRODUCT) {
    throw new InvalidImageError(`You can upload at most ${MAX_IMAGES_PER_PRODUCT} images.`);
  }

  for (const file of real) {
    const ext = ACCEPTED_TYPES[file.type];
    if (!ext) {
      throw new InvalidImageError(
        `"${file.name}" isn't a supported image type. Use JPEG, PNG, WEBP, or GIF.`,
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new InvalidImageError(`"${file.name}" is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
    }
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const saved: string[] = [];
  for (const file of real) {
    const ext = ACCEPTED_TYPES[file.type];
    const buffer = Buffer.from(await file.arrayBuffer());

    if (!hasValidImageSignature(buffer, file.type)) {
      throw new InvalidImageError(`"${file.name}" doesn't look like a valid image file.`);
    }

    // Random filename: never trust/reuse the client-supplied name (path
    // traversal, collisions, or an attempt to overwrite another file).
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    saved.push(`${PUBLIC_PREFIX}/${filename}`);
  }

  return saved;
}

/**
 * Combines images a caller is keeping (edit forms: previously-uploaded
 * paths the user didn't remove) with newly-uploaded ones, capped at the
 * per-product limit. Always re-applied server-side even though the
 * client-side form already enforces the same cap, since the client is
 * not a trust boundary.
 */
export function combineImages(existing: string[], uploaded: string[]): string[] {
  return [...existing, ...uploaded].slice(0, MAX_IMAGES_PER_PRODUCT);
}

/**
 * Server-side allowlist check for `existingImages` values a form posts
 * back (edit forms echo previously-saved paths as hidden inputs so the
 * user can remove one). Only `/uploads/...` paths this module itself
 * could have produced are accepted — an arbitrary posted string is
 * dropped rather than trusted, so this can't be used to inject an
 * arbitrary URL into `Product.images` by editing form fields.
 */
export function sanitizeExistingImagePaths(values: FormDataEntryValue[]): string[] {
  return values.filter(
    (value): value is string =>
      typeof value === "string" && /^\/uploads\/[A-Za-z0-9_-]+\.(jpg|png|webp|gif)$/.test(value),
  );
}
