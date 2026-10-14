import "server-only";
import { getConfig, supabaseCredentials, type AppConfig } from "../config";
import { ALL_PERMISSIONS, SYSTEM_ROLE_DEFAULTS } from "../auth/permissions";
import { BadRequestError } from "../errors";
import type { Database } from "../types";
import { createJsonAdapter } from "./adapters/json";
import type { StorageAdapter } from "./adapters/types";
import { createSeed, defaultAlertSettings, defaultBranding, defaultDataSettings, defaultRoles } from "./seed";

/**
 * In-memory snapshot of the dataset, persisted through a pluggable adapter
 * (local JSON file or Supabase). The repository layer only sees read/write.
 *
 * Next.js can load this module more than once per process (route handlers vs.
 * server components live in separate bundles), so shared state lives on globalThis.
 */
export const SCHEMA_VERSION = 1;
/**
 * Bump whenever normalise() learns a new field/migration. A cached snapshot built by an
 * older revision (e.g. kept across a dev hot-reload) is re-loaded and re-normalised.
 */
const NORMALISE_REVISION = 5;

type StoreState = {
  revision?: number;
  adapter: StorageAdapter | null;
  adapterKey: string;
  cache: Database | null;
  queue: Promise<unknown>;
  listeners: Set<() => void>;
};
const g = globalThis as typeof globalThis & { __inventoryStoreV2?: StoreState };
const state: StoreState = (g.__inventoryStoreV2 ??= {
  adapter: null, adapterKey: "", cache: null, queue: Promise.resolve(), listeners: new Set(),
});

export async function createAdapter(config: AppConfig): Promise<StorageAdapter> {
  if (config.provider === "supabase") {
    const { url, serviceKey } = supabaseCredentials(config);
    if (!url || !serviceKey) throw new BadRequestError("Save your Supabase URL and service_role key first");
    const { createSupabaseAdapter } = await import("./adapters/supabase");
    return createSupabaseAdapter(url, serviceKey);
  }
  return createJsonAdapter();
}

async function adapter(): Promise<StorageAdapter> {
  const config = await getConfig();
  const creds = supabaseCredentials(config);
  const key = config.provider === "supabase" ? `supabase:${creds.url}:${creds.serviceKey.slice(-6)}` : "local";
  if (!state.adapter || state.adapterKey !== key) {
    state.adapter = await createAdapter(config);
    state.adapterKey = key;
    state.cache = null;
  }
  return state.adapter;
}

/** One-time migration: mark records that came from the original sample dataset as demo. */
function tagExistingDemoRecords(db: Database) {
  const sample = createSeed(SCHEMA_VERSION);
  const skus = new Set(sample.products.map((p) => p.sku));
  const categoryNames = new Set(sample.categories.map((c) => c.name));
  const supplierNames = new Set(sample.suppliers.map((s) => s.name));
  for (const c of db.categories) if (categoryNames.has(c.name)) c.demo = true;
  for (const s of db.suppliers) if (supplierNames.has(s.name)) s.demo = true;
  for (const p of db.products) if (skus.has(p.sku)) p.demo = true;
  const demoProducts = new Set(db.products.filter((p) => p.demo).map((p) => p.id));
  for (const m of db.movements) if (demoProducts.has(m.productId)) m.demo = true;
  db.demoTagged = true;
}

function normalise(db: Database): Database {
  // Back-fill fields added after the store was first created.
  db.branding ??= defaultBranding();
  db.users ??= [];
  db.alertSettings = { ...defaultAlertSettings(), ...db.alertSettings };
  db.alerts ??= [];
  db.dataSettings = { ...defaultDataSettings(), ...db.dataSettings };
  if (!db.demoTagged) tagExistingDemoRecords(db);
  db.roles = db.roles?.length ? db.roles : defaultRoles();
  // Permissions added in newer versions are granted to built-in roles that have them by default.
  const known = new Set(db.permissionCatalog ?? ALL_PERMISSIONS.filter((p) => !p.startsWith("logs.")));
  const added = ALL_PERMISSIONS.filter((p) => !known.has(p));
  if (added.length) {
    for (const role of db.roles) {
      const defaults = SYSTEM_ROLE_DEFAULTS.find((d) => d.id === role.id)?.permissions ?? [];
      role.permissions = [...new Set([...role.permissions, ...added.filter((p) => defaults.includes(p))])];
    }
  }
  db.permissionCatalog = [...ALL_PERMISSIONS];
  return db;
}

async function load(): Promise<Database> {
  const a = await adapter();
  if (state.cache && state.revision === NORMALISE_REVISION && !(await a.isStale())) return state.cache;
  const loaded = await a.load();
  if (loaded) {
    const before = JSON.stringify(loaded);
    const normalised = normalise(structuredClone(loaded));
    // Persist migrations right away so every backend (and every process) sees them.
    if (JSON.stringify(normalised) !== before) await a.save(normalised, loaded);
    state.cache = normalised;
    state.revision = NORMALISE_REVISION;
  } else {
    state.cache = createSeed(SCHEMA_VERSION);
    await a.save(state.cache, null);
    state.revision = NORMALISE_REVISION;
  }
  return state.cache;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = state.queue.then(task);
  state.queue = run.catch(() => undefined);
  return run;
}

export async function read<T>(fn: (db: Readonly<Database>) => T): Promise<T> {
  await state.queue;
  return fn(await load());
}

/** Runs `fn` against a draft copy; changes are committed only if it doesn't throw. */
export function write<T>(fn: (db: Database) => T): Promise<T> {
  return enqueue(async () => {
    const current = await load();
    const draft = structuredClone(current);
    const result = fn(draft);
    await (await adapter()).save(draft, current);
    state.cache = draft;
    for (const l of state.listeners) l();
    return result;
  });
}

/** Full snapshot of the active database (used by backups and migrations). */
export const snapshot = () => read((db) => structuredClone(db) as Database);

/**
 * Replaces inventory data (restore). Users and roles are always kept so a restore
 * can never lock you out or resurrect deleted accounts.
 */
export function replaceAll(next: Database, { keepBranding = false } = {}) {
  return write((db) => {
    const branding = keepBranding ? db.branding : (next.branding ?? db.branding);
    // Alerts refer to products of the current dataset, so they're cleared rather than restored.
    Object.assign(db, normalise({
      ...structuredClone(next), branding, users: db.users, roles: db.roles, alertSettings: db.alertSettings, alerts: [],
      dataSettings: db.dataSettings,
    }));
  });
}

/** Called after every committed write. Returns an unsubscribe function. */
export function onCommit(listener: () => void) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

/** Drops the cached adapter/snapshot so the next access uses the current config. */
export function resetStore() {
  return enqueue(async () => {
    state.adapter = null;
    state.adapterKey = "";
    state.cache = null;
  });
}

export async function resetDatabase(empty = false) {
  return write((db) => {
    const keep = {
      branding: db.branding, users: db.users, roles: db.roles, alertSettings: db.alertSettings, alerts: [],
      dataSettings: db.dataSettings, demoTagged: true,
    };
    const fresh: Database = empty
      ? { version: SCHEMA_VERSION, ...keep, categories: [], suppliers: [], products: [], movements: [] }
      : { ...createSeed(SCHEMA_VERSION), ...keep };
    // Branding, users and roles are workspace configuration, so they survive data resets.
    Object.assign(db, fresh);
  });
}
