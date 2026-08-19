import { z } from "zod";

// PRODUCT_CONDITIONS mirrors the Prisma `ProductCondition` enum. Kept as a
// plain string tuple here (rather than importing the Prisma enum) so this
// file has zero dependency on `@prisma/client` and stays usable from client
// components that just need the option list for a <select>.
export const PRODUCT_CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] as const;

export const decimalString = z
  .string()
  .trim()
  .min(1, "Price is required.")
  .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), "Enter a price like 12.99.")
  .refine((val) => Number(val) > 0, "Price must be greater than 0.")
  .refine((val) => Number(val) < 100000, "Price must be less than 100,000.");

export const intString = (label: string, opts: { min?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((val) => /^\d+$/.test(val), `${label} must be a whole number.`)
    .refine((val) => Number(val) >= (opts.min ?? 0), `${label} cannot be negative.`);

// Images are now real uploaded files (see lib/uploads/save-images.ts and
// components/ui/image-upload.tsx) rather than pasted URLs, so they're
// handled outside this Zod schema: the server action reads `imageFiles`
// (new uploads) and `existingImages` (kept-from-edit paths) off the raw
// FormData directly, validates/saves them via saveUploadedImages(), and
// merges the resulting `string[]` into the create/update call itself. This
// schema only covers the fields that map straight from a form value to a
// validated scalar.
export const productSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(150),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters.")
    .max(800, "Keep the description under 800 characters."),
  price: decimalString,
  condition: z.enum(PRODUCT_CONDITIONS, {
    errorMap: () => ({ message: "Select a condition." }),
  }),
  categoryId: z.string().trim().min(1, "Select a category."),
  stock: intString("Stock"),
  lowStockThreshold: intString("Low-stock threshold"),
  available: z.union([z.literal("on"), z.literal(null)]).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

// Staff can adjust stock and toggle availability, but never touch catalog
// metadata (name/price/description/category) — that split matches the
// Admin vs Staff use-case diagrams (only Admin has Add/Update/Remove
// Products; Staff has Manage Store Inventory / Update Product Availability).
export const stockUpdateSchema = z.object({
  productId: z.string().trim().min(1),
  stock: intString("Stock"),
  lowStockThreshold: intString("Low-stock threshold"),
  available: z.union([z.literal("on"), z.literal(null)]).optional(),
});

export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
