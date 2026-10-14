import "server-only";
import { hashPassword } from "../auth/password";
import { SUPERADMIN_ROLE_ID, type Permission } from "../auth/permissions";
import { DEV_MODE } from "../modes";
import type { Database, Role, User } from "../types";

/**
 * Demo accounts, read from env vars so an ephemeral deployment (e.g. Vercel with the local
 * JSON store) boots with ready-made logins without committing credentials. Only used when
 * NEXT_PUBLIC_DEV_MODE=true. Each account needs both <ROLE>_EMAIL and <ROLE>_PASSWORD;
 * <ROLE>_NAME is optional. See .env.example.
 */
const MANAGER_PERMISSIONS: Permission[] = [
  "dashboard.view", "products.view", "products.create", "products.edit",
  "movements.view", "stock.record", "categories.view", "suppliers.view",
];

const ACCOUNTS = [
  { key: "superadmin", env: "SUPERADMIN", roleId: SUPERADMIN_ROLE_ID, label: "Super Admin" },
  { key: "admin", env: "ADMIN", roleId: "admin", label: "Admin" },
  { key: "manager", env: "MANAGER", roleName: "Manager", permissions: MANAGER_PERMISSIONS, label: "Manager" },
  { key: "staff", env: "STAFF", roleId: "staff", label: "Staff" },
] as const;

export type DemoAccountKey = (typeof ACCOUNTS)[number]["key"];
export const DEMO_ACCOUNT_KEYS = ACCOUNTS.map((a) => a.key) as [DemoAccountKey, ...DemoAccountKey[]];

const MIN_PASSWORD = 8;

/** Demo accounts with a usable email + password in the environment (empty unless dev mode is on). */
export function demoAccounts() {
  if (!DEV_MODE) return [];
  return ACCOUNTS.flatMap((account) => {
    const email = process.env[`${account.env}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${account.env}_PASSWORD`];
    if (!email && !password) return [];
    if (!email || !password) {
      console.error(`[demo-users] Set both ${account.env}_EMAIL and ${account.env}_PASSWORD. Skipped.`);
      return [];
    }
    if (password.length < MIN_PASSWORD) {
      console.error(`[demo-users] ${account.env}_PASSWORD must be at least ${MIN_PASSWORD} characters. Skipped.`);
      return [];
    }
    const name = process.env[`${account.env}_NAME`]?.trim() || account.label;
    return [{ ...account, email, password, name }];
  });
}

/** Adds any configured demo account that is missing (no-op when dev mode is off). */
export async function applyDemoUsers(db: Database) {
  const now = new Date().toISOString();

  for (const account of demoAccounts()) {
    if (db.users.some((u) => u.email === account.email)) continue;

    let role = "roleId" in account ? db.roles.find((r) => r.id === account.roleId) : db.roles.find((r) => r.name === account.roleName);
    if (!role && "roleName" in account) {
      const created: Role = { id: crypto.randomUUID(), name: account.roleName, permissions: [...account.permissions], system: false, createdAt: now };
      db.roles.push(created);
      role = created;
    }
    if (!role) continue;

    const user: User = {
      id: crypto.randomUUID(), name: account.name, email: account.email, passwordHash: await hashPassword(account.password),
      roleId: role.id, active: true, sessionVersion: 0, createdAt: now, lastLoginAt: null,
    };
    db.users.push(user);
  }
}
