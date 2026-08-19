import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  description: z.string().trim().max(500).optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/**
 * Derives a URL-safe slug from a category name (e.g. "Vinyl & Records" ->
 * "vinyl-records"). Collisions are handled by the caller appending a
 * numeric suffix, since slug uniqueness is enforced at the DB level
 * (`Category.slug @unique`) and a race here is only a cosmetic concern.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
