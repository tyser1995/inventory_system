/** Permission catalog — shared by server (enforcement) and client (UI gating). */

export const PERMISSION_GROUPS = [
  {
    group: "Inventory",
    items: [
      { key: "dashboard.view", label: "View dashboard" },
      { key: "products.view", label: "View products" },
      { key: "products.create", label: "Create products" },
      { key: "products.edit", label: "Edit products" },
      { key: "products.delete", label: "Delete products" },
      { key: "movements.view", label: "View stock ledger" },
      { key: "stock.record", label: "Record stock in / out" },
    ],
  },
  {
    group: "Catalog",
    items: [
      { key: "categories.view", label: "View categories" },
      { key: "categories.manage", label: "Manage categories" },
      { key: "suppliers.view", label: "View suppliers" },
      { key: "suppliers.manage", label: "Manage suppliers" },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "settings.branding", label: "Change branding" },
      { key: "settings.backup", label: "Manage backups" },
      { key: "settings.alerts", label: "Manage stock alert settings" },
      { key: "settings.database", label: "Manage database connection" },
      { key: "data.reset", label: "Reset / clear data" },
      { key: "users.manage", label: "Manage users" },
      { key: "roles.manage", label: "Manage roles" },
      { key: "logs.view", label: "View activity & error logs" },
      { key: "logs.manage", label: "Resolve errors & log settings" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const SUPERADMIN_ROLE_ID = "superadmin";

export const isPermission = (v: string): v is Permission => (ALL_PERMISSIONS as string[]).includes(v);

/** Built-in roles. Super Admin always has every permission and can't be edited. */
export const SYSTEM_ROLE_DEFAULTS: { id: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    id: SUPERADMIN_ROLE_ID,
    name: "Super Admin",
    description: "Full access, including database, roles and other super admins",
    permissions: ALL_PERMISSIONS,
  },
  {
    id: "admin",
    name: "Admin",
    description: "Runs day-to-day operations and manages staff accounts",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "settings.database" && p !== "roles.manage"),
  },
  {
    id: "staff",
    name: "Staff",
    description: "Views inventory and records stock movements",
    permissions: ["dashboard.view", "products.view", "movements.view", "stock.record", "categories.view", "suppliers.view"],
  },
];
