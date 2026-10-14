import "server-only";
import { hashPassword } from "../auth/password";
import { SUPERADMIN_ROLE_ID, type Permission } from "../auth/permissions";
import type { Database, Role, User } from "../types";

/**
 * Accounts created when a brand-new database is seeded, read from env vars so an ephemeral
 * deployment (e.g. Vercel with the local JSON store) boots with ready-made logins without
 * committing credentials. Each account needs both <ROLE>_EMAIL and <ROLE>_PASSWORD;
 * <ROLE>_NAME is optional. See .env.example.
 */
const MANAGER_PERMISSIONS: Permission[] = [
  "dashboard.view", "products.view", "products.create", "products.edit",
  "movements.view", "stock.record", "categories.view", "suppliers.view",
];

const ACCOUNTS = [
  { env: "SUPERADMIN", roleId: SUPERADMIN_ROLE_ID, name: "Super Admin" },
  { env: "ADMIN", roleId: "admin", name: "Admin" },
  { env: "MANAGER", roleName: "Manager", permissions: MANAGER_PERMISSIONS, name: "Manager" },
  { env: "STAFF", roleId: "staff", name: "Staff" },
] as const;

const MIN_PASSWORD = 8;

export async function applyDemoUsers(db: Database) {
  const now = new Date().toISOString();

  for (const account of ACCOUNTS) {
    const email = process.env[`${account.env}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${account.env}_PASSWORD`];
    if (!email && !password) continue;
    if (!email || !password) {
      console.error(`[demo-users] Set both ${account.env}_EMAIL and ${account.env}_PASSWORD. Skipped.`);
      continue;
    }
    if (password.length < MIN_PASSWORD) {
      console.error(`[demo-users] ${account.env}_PASSWORD must be at least ${MIN_PASSWORD} characters. Skipped.`);
      continue;
    }
    if (db.users.some((u) => u.email === email)) continue;

    let role = "roleId" in account ? db.roles.find((r) => r.id === account.roleId) : db.roles.find((r) => r.name === account.roleName);
    if (!role && "roleName" in account) {
      const created: Role = { id: crypto.randomUUID(), name: account.roleName, permissions: [...account.permissions], system: false, createdAt: now };
      db.roles.push(created);
      role = created;
    }
    if (!role) continue;

    const user: User = {
      id: crypto.randomUUID(), name: process.env[`${account.env}_NAME`]?.trim() || account.name, email,
      passwordHash: await hashPassword(password), roleId: role.id, active: true, sessionVersion: 0, createdAt: now, lastLoginAt: null,
    };
    db.users.push(user);
  }
}
