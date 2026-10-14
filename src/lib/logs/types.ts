/** Shared log shapes (server + client). */

export type AuditCategory = "auth" | "navigation" | "inventory" | "catalog" | "users" | "settings" | "backup" | "database" | "logs" | "api";
export type AuditOutcome = "success" | "denied" | "failed";

export interface AuditEntry {
  id: string;
  ts: string;
  action: string;
  category: AuditCategory;
  outcome: AuditOutcome;
  userId?: string;
  userName?: string;
  role?: string;
  /** e.g. "Ryzen 9 7950X" or "staff@acme.com" */
  target?: string;
  targetId?: string;
  details?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
}

export type ErrorSource = "server" | "client" | "background" | "upstream";
export type ErrorLevel = "error" | "warning";
export type ErrorStatus = "open" | "resolved" | "ignored";

export interface ErrorEntry {
  id: string;
  ts: string;
  fingerprint: string;
  level: ErrorLevel;
  source: ErrorSource;
  message: string;
  name?: string;
  stack?: string;
  method?: string;
  path?: string;
  url?: string;
  digest?: string;
  userId?: string;
  userName?: string;
  userAgent?: string;
}

export interface ErrorGroup {
  fingerprint: string;
  message: string;
  name?: string;
  source: ErrorSource;
  level: ErrorLevel;
  path?: string;
  count: number;
  users: number;
  firstSeen: string;
  lastSeen: string;
  status: ErrorStatus;
  note?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "auth", label: "Sign-in" },
  { value: "navigation", label: "Page views" },
  { value: "inventory", label: "Inventory" },
  { value: "catalog", label: "Catalog" },
  { value: "users", label: "Users & roles" },
  { value: "settings", label: "Settings" },
  { value: "backup", label: "Backups" },
  { value: "database", label: "Database" },
  { value: "logs", label: "Logs" },
  { value: "api", label: "Other API" },
];
