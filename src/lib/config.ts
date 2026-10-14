import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Server-side app configuration (database provider, credentials, backup policy).
 * Lives in data/config.json — never sent to the browser as-is (see publicConfig).
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars take precedence over the file.
 */

export type Provider = "local" | "supabase";
export type BackupFrequency = "hourly" | "6h" | "12h" | "daily" | "weekly";

export interface AppConfig {
  provider: Provider;
  /** HMAC key for session cookies (generated on first use unless AUTH_SECRET is set). */
  authSecret?: string;
  supabase: { url: string; serviceKey: string };
  logs: {
    /** Daily log files older than this are deleted. */
    retentionDays: number;
    /** Record every page a user opens (navigation trail). */
    trackPageViews: boolean;
  };
  backup: {
    /** Back up automatically after data changes, at most once per interval. */
    auto: { enabled: boolean; intervalMinutes: number };
    /** Safety snapshot before restore, reset and provider switches. */
    safety: boolean;
    schedule: { enabled: boolean; frequency: BackupFrequency; time: string; weekday: number };
    /** How many automatic/scheduled backups to keep. Manual backups are never pruned. */
    retention: number;
    lastAutoAt: string | null;
    lastScheduledAt: string | null;
  };
}

// turbopackIgnore: runtime data files must not be traced/bundled into the build output.
export const DATA_DIR = process.env.INVENTORY_DATA_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export const DEFAULT_CONFIG: AppConfig = {
  provider: "local",
  supabase: { url: "", serviceKey: "" },
  logs: { retentionDays: 90, trackPageViews: true },
  backup: {
    auto: { enabled: true, intervalMinutes: 60 },
    safety: true,
    schedule: { enabled: false, frequency: "daily", time: "02:00", weekday: 0 },
    retention: 20,
    lastAutoAt: null,
    lastScheduledAt: null,
  },
};

type State = { config: AppConfig | null; queue: Promise<unknown> };
const g = globalThis as typeof globalThis & { __inventoryConfig?: State };
const state: State = (g.__inventoryConfig ??= { config: null, queue: Promise.resolve() });

function merge(file: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...file,
    supabase: { ...DEFAULT_CONFIG.supabase, ...file.supabase },
    logs: { ...DEFAULT_CONFIG.logs, ...file.logs },
    backup: {
      ...DEFAULT_CONFIG.backup,
      ...file.backup,
      auto: { ...DEFAULT_CONFIG.backup.auto, ...file.backup?.auto },
      schedule: { ...DEFAULT_CONFIG.backup.schedule, ...file.backup?.schedule },
    },
  };
}

export async function getConfig(): Promise<AppConfig> {
  if (!state.config) {
    try {
      state.config = merge(JSON.parse(await fs.readFile(CONFIG_FILE, "utf8")));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      state.config = structuredClone(DEFAULT_CONFIG);
    }
  }
  return state.config;
}

export function updateConfig(fn: (c: AppConfig) => void): Promise<AppConfig> {
  const run = state.queue.then(async () => {
    const next = structuredClone(await getConfig());
    fn(next);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${CONFIG_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
    await fs.rename(tmp, CONFIG_FILE);
    state.config = next;
    return next;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

/** Effective Supabase credentials (env overrides file). */
export function supabaseCredentials(c: AppConfig) {
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    url: envUrl || c.supabase.url,
    serviceKey: envKey || c.supabase.serviceKey,
    fromEnv: Boolean(envUrl && envKey),
  };
}

const mask = (key: string) => (key ? `••••••••${key.slice(-4)}` : "");

/** Safe-to-expose view of the config. */
export function publicConfig(c: AppConfig) {
  const creds = supabaseCredentials(c);
  return {
    provider: c.provider,
    supabase: { url: creds.url, keyHint: mask(creds.serviceKey), configured: Boolean(creds.url && creds.serviceKey), fromEnv: creds.fromEnv },
    backup: c.backup,
  };
}

export type PublicConfig = ReturnType<typeof publicConfig>;
