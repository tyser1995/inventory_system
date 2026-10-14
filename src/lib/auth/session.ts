import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { DATA_DIR, getConfig, updateConfig } from "../config";

export const SESSION_COOKIE = "sv_session";
const SHORT_TTL = 12 * 3600; // seconds — browser-session login
const LONG_TTL = 30 * 24 * 3600; // "remember me"

interface SessionPayload {
  /** Random session id, so a single session can be revoked on sign-out. */
  sid: string;
  uid: string;
  /** Must match user.sessionVersion, so password changes / deactivation revoke old cookies. */
  v: number;
  exp: number;
}

async function secret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const config = await getConfig();
  if (config.authSecret) return config.authSecret;
  const generated = randomBytes(32).toString("base64url");
  await updateConfig((c) => void (c.authSecret ??= generated));
  return (await getConfig()).authSecret!;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest("base64url");

export async function createSessionToken(uid: string, version: number, remember: boolean) {
  const payload: SessionPayload = { sid: randomBytes(12).toString("base64url"), uid, v: version, exp: Math.floor(Date.now() / 1000) + (remember ? LONG_TTL : SHORT_TTL) };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body, await secret())}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body, await secret()));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp <= Date.now() / 1000) return null;
    if ((await revoked())[payload.sid]) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(uid: string, version: number, remember: boolean) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(uid, version, remember), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Omitting maxAge makes it a browser-session cookie.
    ...(remember ? { maxAge: LONG_TTL } : {}),
  });
}

/* ───────── Revocation (sign-out) ─────────
 * Signed-out session ids are kept until their natural expiry so a copied cookie stops working
 * immediately. Stored in data/revoked-sessions.json, pruned on every write. */
const REVOKED_FILE = path.join(DATA_DIR, "revoked-sessions.json");
const g = globalThis as typeof globalThis & { __revoked?: Record<string, number> };

async function revoked(): Promise<Record<string, number>> {
  if (!g.__revoked) {
    try {
      g.__revoked = JSON.parse(await fs.readFile(REVOKED_FILE, "utf8")) as Record<string, number>;
    } catch {
      g.__revoked = {};
    }
  }
  return g.__revoked;
}

async function revokeSession(payload: SessionPayload) {
  const now = Date.now() / 1000;
  const next = Object.fromEntries(Object.entries(await revoked()).filter(([, exp]) => exp > now));
  next[payload.sid] = payload.exp;
  g.__revoked = next;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REVOKED_FILE, JSON.stringify(next), "utf8");
}

/** Signs out this session: revokes its id server-side and deletes the cookie. */
export async function clearSessionCookie() {
  const jar = await cookies();
  const payload = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (payload?.sid) await revokeSession(payload);
  jar.delete(SESSION_COOKIE);
}

export async function readSessionCookie() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
