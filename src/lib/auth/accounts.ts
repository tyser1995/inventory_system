import "server-only";
import { read, write } from "../db/store";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError } from "../errors";
import type { Role, User } from "../types";
import type { RoleInput, UserCreateInput, UserUpdateInput } from "../validation";
import { permissionsOf, toPublicUser, type AuthContext } from "./guard";
import { dummyVerify, hashPassword, verifyPassword } from "./password";
import { SUPERADMIN_ROLE_ID, type Permission } from "./permissions";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const normEmail = (e: string) => e.trim().toLowerCase();

/* ───────────────────────── Policy helpers ───────────────────────── */

/** A non-superadmin may only grant or manage access they hold themselves (no privilege escalation). */
function canHandleRole(actor: AuthContext, role: Role | undefined) {
  if (!role) return false;
  if (actor.isSuperadmin) return true;
  if (role.id === SUPERADMIN_ROLE_ID) return false;
  return permissionsOf(role).every((p) => actor.permissions.includes(p));
}

function activeSuperadmins(users: User[]) {
  return users.filter((u) => u.active && u.roleId === SUPERADMIN_ROLE_ID);
}

/* ───────────────────────── Setup & login ───────────────────────── */

export const needsSetup = () => read((db) => db.users.length === 0);

export async function createFirstSuperadmin(input: { name: string; email: string; password: string }) {
  const passwordHash = await hashPassword(input.password);
  return write((db) => {
    // Checked inside the write so two concurrent setup requests can't both succeed.
    if (db.users.length > 0) throw new ForbiddenError("Setup has already been completed");
    const user: User = {
      id: uid(), name: input.name.trim(), email: normEmail(input.email), passwordHash, roleId: SUPERADMIN_ROLE_ID,
      active: true, sessionVersion: 0, createdAt: now(), lastLoginAt: now(),
    };
    db.users.push(user);
    return user;
  });
}

/* In-memory brute-force protection: 5 failures per email+IP → 15-minute lockout. */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
const g = globalThis as typeof globalThis & { __loginAttempts?: Map<string, { count: number; first: number }> };
const attempts = (g.__loginAttempts ??= new Map());

export async function login(email: string, password: string, ip: string) {
  const key = `${normEmail(email)}|${ip}`;
  const entry = attempts.get(key);
  if (entry && Date.now() - entry.first < WINDOW_MS && entry.count >= MAX_FAILURES) {
    const mins = Math.ceil((entry.first + WINDOW_MS - Date.now()) / 60_000);
    throw new RateLimitError(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  const user = await read((db) => db.users.find((u) => u.email === normEmail(email)));
  const ok = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);

  if (!ok || !user) {
    const fresh = !entry || Date.now() - entry.first >= WINDOW_MS;
    attempts.set(key, fresh ? { count: 1, first: Date.now() } : { ...entry, count: entry.count + 1 });
    throw new UnauthorizedError("Incorrect email or password");
  }
  if (!user.active) throw new ForbiddenError("This account has been deactivated. Contact an administrator.");

  attempts.delete(key);
  await write((db) => {
    const u = db.users.find((x) => x.id === user.id);
    if (u) u.lastLoginAt = now();
  });
  return user;
}

/** Dev mode one-click sign-in: no password check, but the account must exist and be active. */
export async function loginDemoAccount(email: string) {
  const user = await read((db) => db.users.find((u) => u.email === normEmail(email)));
  if (!user) throw new NotFoundError("This demo account doesn't exist yet");
  if (!user.active) throw new ForbiddenError("This account has been deactivated. Contact an administrator.");
  await write((db) => {
    const u = db.users.find((x) => x.id === user.id);
    if (u) u.lastLoginAt = now();
  });
  return user;
}

/* ───────────────────────── Own account ───────────────────────── */

export async function updateOwnProfile(actor: AuthContext, input: { name: string; email: string }) {
  return write((db) => {
    const user = db.users.find((u) => u.id === actor.user.id);
    if (!user) throw new NotFoundError("User not found");
    const email = normEmail(input.email);
    if (db.users.some((u) => u.id !== user.id && u.email === email)) throw new ConflictError("That email is already in use");
    user.name = input.name.trim();
    user.email = email;
    return toPublicUser(user);
  });
}

export async function changeOwnPassword(actor: AuthContext, current: string, next: string) {
  const user = await read((db) => db.users.find((u) => u.id === actor.user.id));
  if (!user) throw new NotFoundError("User not found");
  if (!(await verifyPassword(current, user.passwordHash))) throw new BadRequestError("Current password is incorrect");
  const passwordHash = await hashPassword(next);
  return write((db) => {
    const u = db.users.find((x) => x.id === user.id)!;
    u.passwordHash = passwordHash;
    u.sessionVersion += 1; // signs out other devices
    return u;
  });
}

/* ───────────────────────── Users (admin) ───────────────────────── */

export const listUsers = () =>
  read((db) =>
    db.users
      .map((u) => ({ ...toPublicUser(u), roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

export async function createUser(actor: AuthContext, input: UserCreateInput) {
  const passwordHash = await hashPassword(input.password);
  return write((db) => {
    const role = db.roles.find((r) => r.id === input.roleId);
    if (!role) throw new BadRequestError("Choose a valid role");
    if (!canHandleRole(actor, role)) throw new ForbiddenError("You can't assign a role with more access than your own");
    const email = normEmail(input.email);
    if (db.users.some((u) => u.email === email)) throw new ConflictError("A user with this email already exists");
    const user: User = {
      id: uid(), name: input.name.trim(), email, passwordHash, roleId: role.id, active: input.active ?? true,
      sessionVersion: 0, createdAt: now(), lastLoginAt: null,
    };
    db.users.push(user);
    return toPublicUser(user);
  });
}

export async function updateUser(actor: AuthContext, id: string, input: UserUpdateInput) {
  return write((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError("User not found");
    const currentRole = db.roles.find((r) => r.id === user.roleId);
    if (!canHandleRole(actor, currentRole)) throw new ForbiddenError("You can't edit a user with more access than your own");

    const self = user.id === actor.user.id;
    if (input.roleId !== undefined && input.roleId !== user.roleId) {
      if (self) throw new BadRequestError("You can't change your own role");
      const nextRole = db.roles.find((r) => r.id === input.roleId);
      if (!nextRole) throw new BadRequestError("Choose a valid role");
      if (!canHandleRole(actor, nextRole)) throw new ForbiddenError("You can't assign a role with more access than your own");
    }
    if (input.active === false && self) throw new BadRequestError("You can't deactivate your own account");
    if (input.email !== undefined) {
      const email = normEmail(input.email);
      if (db.users.some((u) => u.id !== id && u.email === email)) throw new ConflictError("A user with this email already exists");
    }

    const wasActive = user.active;
    if (input.name !== undefined) user.name = input.name.trim();
    if (input.email !== undefined) user.email = normEmail(input.email);
    if (input.roleId !== undefined) user.roleId = input.roleId;
    if (input.active !== undefined) user.active = input.active;
    if (wasActive && !user.active) user.sessionVersion += 1; // sign out immediately

    if (activeSuperadmins(db.users).length === 0) throw new BadRequestError("There must be at least one active Super Admin");
    return toPublicUser(user);
  });
}

export async function resetUserPassword(actor: AuthContext, id: string, password: string) {
  const passwordHash = await hashPassword(password);
  return write((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError("User not found");
    if (!canHandleRole(actor, db.roles.find((r) => r.id === user.roleId)))
      throw new ForbiddenError("You can't reset the password of a user with more access than your own");
    user.passwordHash = passwordHash;
    user.sessionVersion += 1;
  });
}

export async function deleteUser(actor: AuthContext, id: string) {
  return write((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError("User not found");
    if (user.id === actor.user.id) throw new BadRequestError("You can't delete your own account");
    if (!canHandleRole(actor, db.roles.find((r) => r.id === user.roleId)))
      throw new ForbiddenError("You can't delete a user with more access than your own");
    db.users = db.users.filter((u) => u.id !== id);
    if (activeSuperadmins(db.users).length === 0) throw new BadRequestError("There must be at least one active Super Admin");
  });
}

/* ───────────────────────── Roles ───────────────────────── */

export const listRoles = () =>
  read((db) =>
    db.roles
      .map((r) => ({ ...r, permissions: permissionsOf(r), userCount: db.users.filter((u) => u.roleId === r.id).length }))
      .sort((a, b) => Number(b.system) - Number(a.system) || a.name.localeCompare(b.name)),
  );

function assertGrantable(actor: AuthContext, permissions: Permission[]) {
  if (actor.isSuperadmin) return;
  const extra = permissions.filter((p) => !actor.permissions.includes(p));
  if (extra.length) throw new ForbiddenError("You can't grant permissions you don't have yourself");
}

export async function createRole(actor: AuthContext, input: RoleInput) {
  assertGrantable(actor, input.permissions);
  return write((db) => {
    if (db.roles.some((r) => r.name.toLowerCase() === input.name.trim().toLowerCase()))
      throw new ConflictError("A role with this name already exists");
    const role: Role = {
      id: uid(), name: input.name.trim(), description: input.description, permissions: [...new Set(input.permissions)],
      system: false, createdAt: now(),
    };
    db.roles.push(role);
    return role;
  });
}

export async function updateRole(actor: AuthContext, id: string, input: RoleInput) {
  assertGrantable(actor, input.permissions);
  return write((db) => {
    const role = db.roles.find((r) => r.id === id);
    if (!role) throw new NotFoundError("Role not found");
    if (role.id === SUPERADMIN_ROLE_ID) throw new ForbiddenError("The Super Admin role can't be changed");
    if (!canHandleRole(actor, role)) throw new ForbiddenError("You can't edit a role with more access than your own");
    if (actor.user.roleId === id && !actor.isSuperadmin && !input.permissions.includes("roles.manage"))
      throw new BadRequestError("You can't remove role management from your own role");
    if (db.roles.some((r) => r.id !== id && r.name.toLowerCase() === input.name.trim().toLowerCase()))
      throw new ConflictError("A role with this name already exists");
    if (!role.system) role.name = input.name.trim();
    role.description = input.description;
    role.permissions = [...new Set(input.permissions)];
    return role;
  });
}

export async function deleteRole(actor: AuthContext, id: string) {
  return write((db) => {
    const role = db.roles.find((r) => r.id === id);
    if (!role) throw new NotFoundError("Role not found");
    if (role.system) throw new BadRequestError("Built-in roles can't be deleted");
    if (!canHandleRole(actor, role)) throw new ForbiddenError("You can't delete a role with more access than your own");
    const count = db.users.filter((u) => u.roleId === id).length;
    if (count) throw new ConflictError(`Reassign the ${count} user${count === 1 ? "" : "s"} with this role first`);
    db.roles = db.roles.filter((r) => r.id !== id);
  });
}
