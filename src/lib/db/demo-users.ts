import "server-only";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import { isPermission } from "../auth/permissions";
import type { Database, Role, User } from "../types";

/**
 * Accounts created when a brand-new database is seeded, read from the DEMO_USERS env var.
 * Lets an ephemeral deployment (e.g. Vercel with the local JSON store) boot with ready-made
 * logins without committing credentials. JSON array, for example:
 *
 *   [{"name":"Sam Staff","email":"staff@example.com","password":"…","role":"staff"},
 *    {"name":"Morgan","email":"manager@example.com","password":"…","role":"Manager",
 *     "permissions":["dashboard.view","products.view"]}]
 *
 * `role` matches an existing role by id or name; an unknown role is created as a custom role
 * when `permissions` are given.
 */
const DemoUsers = z.array(
  z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.string().trim().min(1),
    permissions: z.array(z.string()).optional(),
  }),
);

export async function applyDemoUsers(db: Database) {
  const raw = process.env.DEMO_USERS;
  if (!raw) return;

  let entries: z.infer<typeof DemoUsers>;
  try {
    entries = DemoUsers.parse(JSON.parse(raw));
  } catch (err) {
    console.error("[demo-users] DEMO_USERS is not valid, no accounts created:", err instanceof Error ? err.message : err);
    return;
  }

  const now = new Date().toISOString();
  for (const entry of entries) {
    if (db.users.some((u) => u.email === entry.email)) continue;

    const key = entry.role.toLowerCase();
    let role = db.roles.find((r) => r.id === key || r.name.toLowerCase() === key);
    if (!role && entry.permissions) {
      const created: Role = {
        id: crypto.randomUUID(), name: entry.role, permissions: entry.permissions.filter(isPermission), system: false, createdAt: now,
      };
      db.roles.push(created);
      role = created;
    }
    if (!role) {
      console.error(`[demo-users] Unknown role "${entry.role}" for ${entry.email}; add "permissions" to create it. Skipped.`);
      continue;
    }

    const user: User = {
      id: crypto.randomUUID(), name: entry.name, email: entry.email, passwordHash: await hashPassword(entry.password),
      roleId: role.id, active: true, sessionVersion: 0, createdAt: now, lastLoginAt: null,
    };
    db.users.push(user);
  }
}
