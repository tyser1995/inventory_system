import { z } from "zod";
import { isPermission, type Permission } from "./auth/permissions";

const optionalText = z.string().trim().max(500).optional().transform((v) => (v ? v : undefined));
const nullableId = z.string().trim().nullish().transform((v) => (v ? v : null));

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optionalText,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => (v ? v : undefined)),
  phone: optionalText,
  address: optionalText,
});

export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
  categoryId: nullableId,
  supplierId: nullableId,
  unit: z.string().trim().min(1).max(20).default("pcs"),
  costPrice: z.coerce.number().min(0, "Must be ≥ 0"),
  sellPrice: z.coerce.number().min(0, "Must be ≥ 0"),
  quantity: z.coerce.number().int("Whole numbers only").min(0, "Must be ≥ 0").default(0),
  reorderLevel: z.coerce.number().int("Whole numbers only").min(0, "Must be ≥ 0").default(0),
  location: optionalText,
});

/** On update, stock quantity is changed only through movements. */
export const productUpdateSchema = productSchema.omit({ quantity: true }).partial();

export const movementSchema = z
  .object({
    productId: z.string().min(1, "Product is required"),
    type: z.enum(["IN", "OUT", "ADJUST"]),
    quantity: z.coerce.number().int("Whole numbers only"),
    note: optionalText,
  })
  .refine((m) => (m.type === "ADJUST" ? m.quantity !== 0 : m.quantity > 0), {
    message: "Quantity must be greater than 0",
    path: ["quantity"],
  });

const MAX_LOGO_BYTES = 512 * 1024;

export const brandingSchema = z.object({
  appName: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
  tagline: z.string().trim().max(60, "Keep it under 60 characters").default(""),
  logo: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG, JPG, WebP, GIF or SVG image")
    .refine((v) => v.length * 0.75 <= MAX_LOGO_BYTES, "Logo must be under 512 KB")
    .nullable(),
});

export const backupPolicySchema = z.object({
  auto: z.object({ enabled: z.boolean(), intervalMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(10080, "At most 1 week") }),
  safety: z.boolean(),
  schedule: z.object({
    enabled: z.boolean(),
    frequency: z.enum(["hourly", "6h", "12h", "daily", "weekly"], "Choose a frequency"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    weekday: z.coerce.number().int().min(0).max(6),
  }),
  retention: z.coerce.number().int().min(1, "Keep at least 1").max(500),
});

export const supabaseCredentialsSchema = z.object({
  url: z.url("Enter your project URL, e.g. https://xyz.supabase.co").refine((u) => u.startsWith("https://") || u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1"), "Use an https:// URL"),
  /** Omit to keep the saved key. */
  serviceKey: z.string().trim().min(20, "Paste the service_role key").optional(),
});

export const switchProviderSchema = z.object({
  provider: z.enum(["local", "supabase"]),
  /** migrate = copy current data to the target; existing = use what the target already holds. */
  mode: z.enum(["migrate", "existing"]),
});

const password = z.string().min(8, "At least 8 characters").max(128, "At most 128 characters");
const email = z.email("Enter a valid email").max(120);
const personName = z.string().trim().min(1, "Name is required").max(80);

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional().default(false),
});

export const setupSchema = z.object({ name: personName, email, password });

export const profileSchema = z.object({ name: personName, email });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: password,
});

export const userCreateSchema = z.object({
  name: personName,
  email,
  roleId: z.string().min(1, "Choose a role"),
  password,
  active: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  name: personName.optional(),
  email: email.optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const passwordResetSchema = z.object({ password });

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  description: z.string().trim().max(160).optional().transform((v) => (v ? v : undefined)),
  permissions: z.array(z.string()).refine((list) => list.every(isPermission), "Unknown permission").transform((l) => l as Permission[]),
});

export const alertSettingsSchema = z.object({
  enabled: z.boolean(),
  notifyRestock: z.boolean(),
  defaultMinStock: z.coerce.number().int("Whole numbers only").min(0, "Must be ≥ 0").max(1_000_000),
});

export const bulkMinStockSchema = z
  .object({
    scope: z.enum(["all", "category"]),
    categoryId: z.string().nullish(),
    minStock: z.coerce.number().int("Whole numbers only").min(0, "Must be ≥ 0").max(1_000_000),
  })
  .refine((v) => v.scope === "all" || v.categoryId !== undefined, { message: "Choose a category", path: ["categoryId"] });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type BackupPolicyInput = z.infer<typeof backupPolicySchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
