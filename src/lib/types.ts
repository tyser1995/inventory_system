import type { Permission } from "./auth/permissions";

export type ID = string;

export interface Category {
  id: ID;
  name: string;
  description?: string;
  createdAt: string;
  /** Sample record shipped with the app (can be disabled or removed). */
  demo?: boolean;
}

export interface Supplier {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  /** Sample record shipped with the app (can be disabled or removed). */
  demo?: boolean;
}

export interface Product {
  id: ID;
  sku: string;
  name: string;
  description?: string;
  categoryId: ID | null;
  supplierId: ID | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  reorderLevel: number;
  location?: string;
  createdAt: string;
  updatedAt: string;
  /** Sample record shipped with the app (can be disabled or removed). */
  demo?: boolean;
}

export type MovementType = "IN" | "OUT" | "ADJUST";

export interface StockMovement {
  id: ID;
  productId: ID;
  type: MovementType;
  /** Signed change applied to stock (ADJUST may be negative). */
  quantity: number;
  balanceAfter: number;
  note?: string;
  /** Who recorded it (denormalised so the ledger survives user deletion). */
  userName?: string;
  createdAt: string;
  /** Sample record shipped with the app (can be disabled or removed). */
  demo?: boolean;
}

export type AlertKind = "low-stock" | "out-of-stock" | "restocked";

/** A stock alert raised when a product crosses its minimum level. */
export interface StockAlert {
  id: ID;
  kind: AlertKind;
  productId: ID;
  productName: string;
  sku: string;
  quantity: number;
  minLevel: number;
  unit: string;
  createdAt: string;
  /** User ids that have read it. */
  readBy: ID[];
}

export interface AlertSettings {
  enabled: boolean;
  /** Also notify when a product goes back above its minimum. */
  notifyRestock: boolean;
  /** Pre-filled minimum stock for new products. */
  defaultMinStock: number;
}

export interface DataSettings {
  /** When false, demo records are excluded from every view, total and action. */
  demoEnabled: boolean;
}

export interface Role {
  id: ID;
  name: string;
  description?: string;
  permissions: Permission[];
  /** Built-in roles can't be deleted or renamed. */
  system: boolean;
  createdAt: string;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  passwordHash: string;
  roleId: ID;
  active: boolean;
  /** Bumped on password change/deactivation to invalidate existing sessions. */
  sessionVersion: number;
  createdAt: string;
  lastLoginAt: string | null;
}

/** User as exposed to the browser. */
export type PublicUser = Omit<User, "passwordHash" | "sessionVersion">;

export interface Branding {
  appName: string;
  tagline: string;
  /** Data URL of the uploaded logo, or null to use the default icon. */
  logo: string | null;
  updatedAt: string;
}

export interface Database {
  version: number;
  branding: Branding;
  /** Permission keys that existed when roles were last reconciled (see store.normalise). */
  permissionCatalog?: string[];
  roles: Role[];
  users: User[];
  alertSettings: AlertSettings;
  alerts: StockAlert[];
  dataSettings: DataSettings;
  /** True once pre-existing sample records have been tagged as demo (one-time migration). */
  demoTagged?: boolean;
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  movements: StockMovement[];
}

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export interface DashboardStats {
  totalProducts: number;
  totalUnits: number;
  inventoryValue: number;
  retailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryBreakdown: { id: ID | null; name: string; value: number; units: number }[];
  movementTrend: { date: string; in: number; out: number }[];
  lowStock: Product[];
  recentMovements: (StockMovement & { productName: string; sku: string })[];
}
