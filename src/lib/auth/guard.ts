import "server-only";
import { read } from "../db/store";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { PublicUser, Role, User } from "../types";
import { ALL_PERMISSIONS, SUPERADMIN_ROLE_ID, type Permission } from "./permissions";
import { readSessionCookie, SESSION_COOKIE, verifySessionToken } from "./session";

export interface AuthContext {
  user: PublicUser;
  role: Pick<Role, "id" | "name">;
  permissions: Permission[];
  isSuperadmin: boolean;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, sessionVersion, ...rest } = user;
  void passwordHash;
  void sessionVersion;
  return rest;
}

export function permissionsOf(role: Role | undefined): Permission[] {
  if (!role) return [];
  return role.id === SUPERADMIN_ROLE_ID ? [...ALL_PERMISSIONS] : role.permissions;
}

/** Resolves the signed-in user from the session cookie, or null. Permissions are read live from the role. */
export async function getAuth(): Promise<AuthContext | null> {
  return resolve(await readSessionCookie());
}

/** Auth context for a user id (e.g. right after login, before the cookie round-trips). */
export async function authForUser(userId: string): Promise<AuthContext | null> {
  const v = await read((db) => db.users.find((u) => u.id === userId)?.sessionVersion);
  return v === undefined ? null : resolve({ sid: "", uid: userId, v, exp: Number.MAX_SAFE_INTEGER });
}

/** Same as getAuth but from a Request's Cookie header (usable outside the request scope, e.g. logging). */
export async function authFromRequest(req: Request): Promise<AuthContext | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return resolve(await verifySessionToken(token ? decodeURIComponent(token) : undefined));
}

async function resolve(session: Awaited<ReturnType<typeof verifySessionToken>>): Promise<AuthContext | null> {
  if (!session) return null;
  return read((db) => {
    const user = db.users.find((u) => u.id === session.uid);
    if (!user || !user.active || user.sessionVersion !== session.v) return null;
    const role = db.roles.find((r) => r.id === user.roleId);
    return {
      user: toPublicUser(user),
      role: { id: role?.id ?? user.roleId, name: role?.name ?? "Unknown role" },
      permissions: permissionsOf(role),
      isSuperadmin: user.roleId === SUPERADMIN_ROLE_ID,
    };
  });
}

/**
 * Throws 401 if not signed in, 403 if the user lacks any of the given permissions.
 * Call at the top of every protected route handler.
 */
export async function authorize(...required: Permission[]): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new UnauthorizedError("Please sign in");
  const missing = required.filter((p) => !auth.permissions.includes(p));
  if (missing.length) throw new ForbiddenError("You don't have permission to do that");
  return auth;
}

/** Like authorize, but passes if the user has at least one of the permissions. */
export async function authorizeAny(...anyOf: Permission[]): Promise<AuthContext> {
  const auth = await authorize();
  if (!anyOf.some((p) => auth.permissions.includes(p))) throw new ForbiddenError("You don't have permission to do that");
  return auth;
}
