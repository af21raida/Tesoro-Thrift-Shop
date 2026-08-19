"use client";

import { useEffect, useRef, useState } from "react";

// Kept in sync with lib/uploads/save-images.ts's MAX_IMAGE_BYTES /
// MAX_IMAGES_PER_PRODUCT — this is a UX convenience (fail fast, show a
// preview) not a trust boundary; the server re-validates everything from
// scratch (type via magic bytes, size, count) since a client check can
// always be bypassed.
const MAX_FILES = 6;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/gif";

interface ImageUploadProps {
  /** Field errors from the server (e.g. "too many images") to surface alongside client-side ones. */
  errors?: string[];
  /** Previously-saved image paths, for edit forms. Omit for create forms. */
  existingImages?: string[];
}

/**
 * Multi-file image picker used by the product/listing/auction forms.
 *
 * Renders three hidden-from-layout pieces of form state that the
 * surrounding <form> submits along with everything else:
 *  - `existingImages` (one hidden input per kept path) — only present when
 *    `existingImages` prop is passed (edit forms); lets the user remove a
 *    previously-uploaded image without re-uploading the ones they keep.
 *  - `imageFiles` — the actual <input type="file" multiple> the browser
 *    fills in; kept in sync via a hidden DataTransfer so "remove before
 *    submit" also works for files that haven't been uploaded yet (nothing
 *    is uploaded until the whole form submits — this only builds local
 *    object-URL previews client-side).
 */
export function ImageUpload({ errors, existingImages = [] }: ImageUploadProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kept, setKept] = useState<string[]>(existingImages);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // Revoke object URLs when they're replaced/unmounted so we don't leak
  // memory across repeated selections.
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only cleans up on unmount/replacement, not every render
  }, [previews]);

  const remainingSlots = Math.max(0, MAX_FILES - kept.length - newFiles.length);

  function syncFileInput(files: File[]): void {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    if (fileInputRef.current) {
      fileInputRef.current.files = transfer.files;
    }
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>): void {
    setLocalError(null);
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    const accepted: File[] = [];
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setLocalError(`"${file.name}" isn't a supported image type (use JPEG, PNG, WEBP, or GIF).`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setLocalError(`"${file.name}" is larger than 4MB.`);
        continue;
      }
      accepted.push(file);
    }

    const availableSlots = MAX_FILES - kept.length - newFiles.length;
    const toAdd = accepted.slice(0, Math.max(0, availableSlots));
    if (accepted.length > toAdd.length) {
      setLocalError(`You can have at most ${MAX_FILES} images total.`);
    }

    const combined = [...newFiles, ...toAdd];
    setNewFiles(combined);
    setPreviews((prevUrls) => {
      prevUrls.forEach((url) => URL.revokeObjectURL(url));
      return combined.map((file) => URL.createObjectURL(file));
    });
    syncFileInput(combined);
  }

  function removeNewFile(index: number): void {
    const next = newFiles.filter((_, i) => i !== index);
    setNewFiles(next);
    setPreviews((prevUrls) => {
      prevUrls.forEach((url) => URL.revokeObjectURL(url));
      return next.map((file) => URL.createObjectURL(file));
    });
    syncFileInput(next);
  }

  function removeExisting(pathToRemove: string): void {
    setKept((prev) => prev.filter((path) => path !== pathToRemove));
  }

  const displayError = localError ?? errors?.[0];

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="imageFiles" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
        Photos{" "}
        <span className="normal-case text-ink-soft/70">
          (up to {MAX_FILES}, JPEG/PNG/WEBP/GIF, 4MB each)
        </span>
      </label>

      {/* Kept-from-edit paths survive submission as hidden fields; the
          server re-validates every value against its own /uploads/...
          allowlist (see sanitizeExistingImagePaths) rather than trusting
          these blindly. */}
      {kept.map((path) => (
        <input key={path} type="hidden" name="existingImages" value={path} />
      ))}

      <input
        ref={fileInputRef}
        id="imageFiles"
        name="imageFiles"
        type="file"
        multiple
        accept={ACCEPTED_ACCEPT_ATTR}
        onChange={handleFilesSelected}
        disabled={remainingSlots === 0}
        className="rounded-tag border border-line bg-paper px-3 py-2 text-sm text-ink outline-none file:mr-3 file:rounded-tag file:border file:border-line file:bg-paper-dim file:px-3 file:py-1.5 file:font-display file:font-semibold file:text-xs file:uppercase file:tracking-wide file:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      />

      {displayError && (
        <p role="alert" className="text-xs text-stamp">
          {displayError}
        </p>
      )}

      {(kept.length > 0 || previews.length > 0) && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {kept.map((path) => (
            <div key={path} className="group relative aspect-square overflow-hidden rounded-tag border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- local /uploads path, not next/image */}
              <img src={path} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeExisting(path)}
                aria-label="Remove image"
                className="absolute right-1 top-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] leading-none text-paper opacity-90 hover:bg-stamp"
              >
                ✕
              </button>
            </div>
          ))}
          {previews.map((src, index) => (
            <div key={src} className="group relative aspect-square overflow-hidden rounded-tag border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not next/image */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeNewFile(index)}
                aria-label="Remove image"
                className="absolute right-1 top-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] leading-none text-paper opacity-90 hover:bg-stamp"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
