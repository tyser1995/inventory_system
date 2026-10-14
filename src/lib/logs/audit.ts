import "server-only";
import type { AuthContext } from "../auth/guard";
import { getConfig } from "../config";
import { appendLog, readLogs } from "./files";
import type { AuditCategory, AuditEntry, AuditOutcome } from "./types";

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export interface AuditInput {
  action: string;
  category: AuditCategory;
  outcome?: AuditOutcome;
  auth?: AuthContext | null;
  /** For events before a session exists (e.g. failed login). */
  actorName?: string;
  target?: string;
  targetId?: string;
  details?: string;
  req?: Request;
  status?: number;
  durationMs?: number;
}

/** Appends an activity entry. Never throws. */
export async function audit(input: AuditInput) {
  try {
    const url = input.req ? new URL(input.req.url) : null;
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      action: input.action,
      category: input.category,
      outcome: input.outcome ?? "success",
      userId: input.auth?.user.id,
      userName: input.auth?.user.name ?? input.actorName,
      role: input.auth?.role.name,
      target: input.target?.slice(0, 200),
      targetId: input.targetId,
      details: input.details?.slice(0, 500),
      method: input.req?.method,
      path: url?.pathname,
      status: input.status,
      durationMs: input.durationMs,
      ip: input.req ? clientIp(input.req) : undefined,
      userAgent: input.req?.headers.get("user-agent")?.slice(0, 200) ?? undefined,
    };
    await appendLog("audit", entry);
  } catch (e) {
    console.error("[audit] failed to record entry", e);
  }
}

/* ───────── Mapping API requests → semantic actions ───────── */

const ID = "([^/]+)";
type Rule = [method: string, pattern: RegExp, action: string, category: AuditCategory];

const RULES: Rule[] = [
  ["POST", /^\/api\/products$/, "product.create", "inventory"],
  ["PATCH", new RegExp(`^/api/products/${ID}$`), "product.update", "inventory"],
  ["DELETE", new RegExp(`^/api/products/${ID}$`), "product.delete", "inventory"],
  ["POST", /^\/api\/movements$/, "stock.record", "inventory"],
  ["POST", /^\/api\/products\/min-stock$/, "product.bulk_min_stock", "inventory"],
  ["PUT", /^\/api\/settings\/alerts$/, "settings.alerts", "settings"],
  ["PUT", /^\/api\/demo$/, "demo.toggle", "database"],
  ["POST", /^\/api\/demo$/, "demo.change", "database"],
  ["POST", /^\/api\/categories$/, "category.create", "catalog"],
  ["PUT", new RegExp(`^/api/categories/${ID}$`), "category.update", "catalog"],
  ["DELETE", new RegExp(`^/api/categories/${ID}$`), "category.delete", "catalog"],
  ["POST", /^\/api\/suppliers$/, "supplier.create", "catalog"],
  ["PUT", new RegExp(`^/api/suppliers/${ID}$`), "supplier.update", "catalog"],
  ["DELETE", new RegExp(`^/api/suppliers/${ID}$`), "supplier.delete", "catalog"],
  ["POST", /^\/api\/users$/, "user.create", "users"],
  ["PATCH", new RegExp(`^/api/users/${ID}$`), "user.update", "users"],
  ["DELETE", new RegExp(`^/api/users/${ID}$`), "user.delete", "users"],
  ["POST", new RegExp(`^/api/users/${ID}/password$`), "user.password_reset", "users"],
  ["POST", /^\/api\/roles$/, "role.create", "users"],
  ["PUT", new RegExp(`^/api/roles/${ID}$`), "role.update", "users"],
  ["DELETE", new RegExp(`^/api/roles/${ID}$`), "role.delete", "users"],
  ["PATCH", /^\/api\/auth\/me$/, "account.update", "auth"],
  ["POST", /^\/api\/auth\/password$/, "account.password_change", "auth"],
  ["PUT", /^\/api\/branding$/, "settings.branding", "settings"],
  ["PUT", /^\/api\/settings\/backup$/, "settings.backup", "settings"],
  ["POST", /^\/api\/backups$/, "backup.create", "backup"],
  ["GET", new RegExp(`^/api/backups/${ID}$`), "backup.download", "backup"],
  ["DELETE", new RegExp(`^/api/backups/${ID}$`), "backup.delete", "backup"],
  ["POST", new RegExp(`^/api/backups/${ID}/restore$`), "backup.restore", "backup"],
  ["POST", /^\/api\/backups\/import$/, "backup.import", "backup"],
  ["POST", /^\/api\/settings\/database\/test$/, "database.test", "database"],
  ["PUT", /^\/api\/settings\/database\/supabase$/, "database.credentials", "database"],
  ["POST", /^\/api\/settings\/database\/switch$/, "database.switch", "database"],
  ["POST", /^\/api\/reset$/, "data.reset", "database"],
  ["PATCH", /^\/api\/logs\/errors$/, "errors.update", "logs"],
  ["PUT", /^\/api\/logs\/settings$/, "settings.logs", "logs"],
  ["GET", /^\/api\/logs\/audit\/export$/, "logs.export", "logs"],
];

/** Endpoints that write their own, richer audit entries. */
const SELF_LOGGED = [/^\/api\/auth\/(login|logout|setup|status)$/, /^\/api\/logs\/(track|client-error)$/];

/** Fields never echoed into logs, even as names-of-changed-fields. */
const SECRET_FIELDS = new Set(["password", "currentPassword", "newPassword", "serviceKey", "logo"]);

function describe(action: string, result: unknown, bodyKeys?: string[]) {
  const r = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const target = (r.name ?? r.sku ?? r.label ?? r.email ?? r.appName) as string | undefined;
  const parts: string[] = [];
  if (action === "stock.record" && typeof r.quantity === "number") parts.push(`${r.type} ${r.quantity > 0 ? "+" : ""}${r.quantity} → balance ${r.balanceAfter}`);
  if (action === "database.switch" && r.provider) parts.push(`Now using ${r.provider}`);
  const keys = bodyKeys?.filter((k) => !SECRET_FIELDS.has(k));
  if (keys?.length && /\.(update|branding|backup|logs)$|^settings\./.test(action)) parts.push(`Fields: ${keys.join(", ")}`);
  if (bodyKeys?.includes("logo")) parts.push("Logo changed");
  return { target, details: parts.join(" · ") || undefined };
}

/** Called by the API wrapper after every request; decides whether and how to log it. */
export async function recordRequest(opts: {
  req: Request;
  status: number;
  result: unknown;
  durationMs: number;
  bodyKeys?: string[];
  auth: AuthContext | null;
  errorMessage?: string;
}) {
  const { req, status } = opts;
  const { pathname } = new URL(req.url);
  if (SELF_LOGGED.some((re) => re.test(pathname))) return;

  const rule = RULES.find(([m, re]) => m === req.method && re.test(pathname));
  const denied = status === 401 || status === 403;
  // Successful reads are not activity; denied reads are (they reveal probing).
  if (!rule && !(denied && pathname !== "/api/auth/me")) return;
  if (status === 401 && pathname === "/api/auth/me") return; // routine "not signed in" check

  const outcome: AuditOutcome = denied ? "denied" : status >= 400 ? "failed" : "success";
  const { target, details } = outcome === "success" ? describe(rule?.[2] ?? "", opts.result, opts.bodyKeys) : { target: undefined, details: opts.errorMessage };
  const targetId = rule ? pathname.match(rule[1])?.[1] : undefined;

  await audit({
    action: rule?.[2] ?? "api.access",
    category: rule?.[3] ?? "api",
    outcome,
    auth: opts.auth,
    target,
    targetId: targetId && targetId.length < 80 ? targetId : undefined,
    details,
    req,
    status,
    durationMs: Math.round(opts.durationMs),
  });
}

/* ───────── Querying ───────── */

export interface AuditQuery {
  from: Date;
  to: Date;
  q?: string;
  userId?: string;
  category?: string;
  outcome?: string;
  page: number;
  pageSize: number;
}

export async function queryAudit(query: AuditQuery) {
  const all = await readLogs<AuditEntry>("audit", query.from, query.to);
  const q = query.q?.trim().toLowerCase();
  const filtered = all.filter(
    (e) =>
      (!query.userId || e.userId === query.userId) &&
      (!query.category || e.category === query.category) &&
      (!query.outcome || e.outcome === query.outcome) &&
      (!q || [e.action, e.userName, e.target, e.details, e.path, e.ip].some((v) => v?.toLowerCase().includes(q))),
  );
  const start = (query.page - 1) * query.pageSize;
  const users = new Map<string, string>();
  for (const e of all) if (e.userId && e.userName) users.set(e.userId, e.userName);
  return {
    entries: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    summary: {
      total: filtered.length,
      denied: filtered.filter((e) => e.outcome === "denied").length,
      failed: filtered.filter((e) => e.outcome === "failed").length,
      activeUsers: new Set(filtered.map((e) => e.userId).filter(Boolean)).size,
    },
    users: [...users].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function logRetentionDays() {
  return (await getConfig()).logs.retentionDays;
}
