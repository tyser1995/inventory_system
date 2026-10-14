import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Permission } from "../../auth/permissions";
import type { AlertSettings, Branding, DataSettings, Category, Product, Role, StockAlert, StockMovement, Supplier, User } from "../../types";
import { UpstreamError } from "../../errors";
import { defaultAlertSettings, defaultBranding, defaultDataSettings, defaultRoles } from "../seed";
import type { StorageAdapter } from "./types";

/** Re-read from Supabase at most this often so edits made in the dashboard show up. */
const STALE_AFTER_MS = 10_000;
const PAGE = 1000;
const CHUNK = 500;

type Row = Record<string, unknown>;

/* ───────── camelCase model ⇄ snake_case rows ───────── */

const mappers = {
  roles: {
    table: "app_roles",
    to: (r: Role): Row => ({ id: r.id, name: r.name, description: r.description ?? null, permissions: r.permissions, system: r.system, created_at: r.createdAt }),
    from: (r: Row): Role => ({
      id: r.id as string, name: r.name as string, description: (r.description as string) ?? undefined,
      permissions: (r.permissions as Permission[]) ?? [], system: Boolean(r.system), createdAt: iso(r.created_at),
    }),
  },
  users: {
    table: "app_users",
    to: (u: User): Row => ({
      id: u.id, name: u.name, email: u.email, password_hash: u.passwordHash, role_id: u.roleId, active: u.active,
      session_version: u.sessionVersion, created_at: u.createdAt, last_login_at: u.lastLoginAt,
    }),
    from: (r: Row): User => ({
      id: r.id as string, name: r.name as string, email: r.email as string, passwordHash: r.password_hash as string,
      roleId: r.role_id as string, active: Boolean(r.active), sessionVersion: Number(r.session_version ?? 0),
      createdAt: iso(r.created_at), lastLoginAt: r.last_login_at ? iso(r.last_login_at) : null,
    }),
  },
  alerts: {
    table: "app_alerts",
    to: (a: StockAlert): Row => ({
      id: a.id, kind: a.kind, product_id: a.productId, product_name: a.productName, sku: a.sku, quantity: a.quantity,
      min_level: a.minLevel, unit: a.unit, created_at: a.createdAt, read_by: a.readBy,
    }),
    from: (r: Row): StockAlert => ({
      id: r.id as string, kind: r.kind as StockAlert["kind"], productId: r.product_id as string, productName: r.product_name as string,
      sku: r.sku as string, quantity: Number(r.quantity), minLevel: Number(r.min_level), unit: (r.unit as string) ?? "pcs",
      createdAt: iso(r.created_at), readBy: (r.read_by as string[]) ?? [],
    }),
  },
  categories: {
    table: "categories",
    to: (c: Category): Row => ({ id: c.id, name: c.name, description: c.description ?? null, created_at: c.createdAt, is_demo: !!c.demo }),
    from: (r: Row): Category => ({ id: r.id as string, name: r.name as string, description: (r.description as string) ?? undefined, createdAt: iso(r.created_at), ...demo(r) }),
  },
  suppliers: {
    table: "suppliers",
    to: (s: Supplier): Row => ({ id: s.id, name: s.name, email: s.email ?? null, phone: s.phone ?? null, address: s.address ?? null, created_at: s.createdAt, is_demo: !!s.demo }),
    from: (r: Row): Supplier => ({
      id: r.id as string, name: r.name as string, email: (r.email as string) ?? undefined,
      phone: (r.phone as string) ?? undefined, address: (r.address as string) ?? undefined, createdAt: iso(r.created_at), ...demo(r),
    }),
  },
  products: {
    table: "products",
    to: (p: Product): Row => ({
      id: p.id, sku: p.sku, name: p.name, description: p.description ?? null, category_id: p.categoryId, supplier_id: p.supplierId,
      unit: p.unit, cost_price: p.costPrice, sell_price: p.sellPrice, quantity: p.quantity, reorder_level: p.reorderLevel,
      location: p.location ?? null, created_at: p.createdAt, updated_at: p.updatedAt, is_demo: !!p.demo,
    }),
    from: (r: Row): Product => ({
      id: r.id as string, sku: r.sku as string, name: r.name as string, description: (r.description as string) ?? undefined,
      categoryId: (r.category_id as string) ?? null, supplierId: (r.supplier_id as string) ?? null, unit: r.unit as string,
      costPrice: Number(r.cost_price), sellPrice: Number(r.sell_price), quantity: Number(r.quantity), reorderLevel: Number(r.reorder_level),
      location: (r.location as string) ?? undefined, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), ...demo(r),
    }),
  },
  movements: {
    table: "stock_movements",
    to: (m: StockMovement): Row => ({
      id: m.id, product_id: m.productId, type: m.type, quantity: m.quantity, balance_after: m.balanceAfter, note: m.note ?? null,
      user_name: m.userName ?? null, created_at: m.createdAt, is_demo: !!m.demo,
    }),
    from: (r: Row): StockMovement => ({
      id: r.id as string, productId: r.product_id as string, type: r.type as StockMovement["type"], quantity: Number(r.quantity),
      balanceAfter: Number(r.balance_after), note: (r.note as string) ?? undefined, userName: (r.user_name as string) ?? undefined,
      createdAt: iso(r.created_at), ...demo(r),
    }),
  },
} as const;

type Collection = keyof typeof mappers;
// Parents before children for upserts; reversed for deletes.
const UPSERT_ORDER: Collection[] = ["roles", "users", "categories", "suppliers", "products", "movements", "alerts"];

/** Only set the flag when true, keeping records identical to the local adapter's shape. */
function demo(r: Row): { demo?: true } {
  return r.is_demo ? { demo: true } : {};
}

function iso(v: unknown) {
  return new Date(v as string).toISOString();
}

function fail(context: string, error: { message: string; code?: string } | null) {
  if (!error) return;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message))
    throw new UpstreamError("Could not reach Supabase — check the project URL and your internet connection");
  if (/invalid api key|jwt|apikey/i.test(error.message) || error.code === "PGRST301")
    throw new UpstreamError("Supabase rejected the key — use the service_role key from Project Settings → API");
  if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message))
    throw new UpstreamError(`Supabase tables are missing — run the schema SQL first (${context})`);
  throw new UpstreamError(`Supabase ${context}: ${error.message || "request failed (check URL and key)"}`);
}

async function selectAll(client: SupabaseClient, table: string, order: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").order(order, { ascending: false }).range(from, from + PAGE - 1);
    fail(`reading ${table}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

export function createSupabaseClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Verifies credentials and that every table exists. */
export async function checkSupabase(url: string, serviceKey: string) {
  const client = createSupabaseClient(url, serviceKey);
  const counts: Record<string, number> = {};
  for (const table of [...UPSERT_ORDER.map((c) => mappers[c].table), "app_settings"]) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    fail(`checking ${table}`, error);
    counts[table] = count ?? 0;
  }
  return counts;
}

export function createSupabaseAdapter(url: string, serviceKey: string): StorageAdapter {
  const client = createSupabaseClient(url, serviceKey);
  let loadedAt = 0;

  return {
    name: "supabase",

    async load() {
      const [roles, users, alerts, categories, suppliers, products, movements, settings] = await Promise.all([
        selectAll(client, "app_roles", "created_at"),
        selectAll(client, "app_users", "created_at"),
        selectAll(client, "app_alerts", "created_at"),
        selectAll(client, "categories", "created_at"),
        selectAll(client, "suppliers", "created_at"),
        selectAll(client, "products", "updated_at"),
        selectAll(client, "stock_movements", "created_at"),
        client.from("app_settings").select("key,value"),
      ]);
      fail("reading app_settings", settings.error);
      loadedAt = Date.now();

      const kv = new Map((settings.data ?? []).map((r) => [r.key as string, r.value]));
      const initialised = kv.has("version");
      if (!initialised && !categories.length && !suppliers.length && !products.length) return null;

      return {
        version: Number(kv.get("version") ?? 1),
        branding: (kv.get("branding") as Branding) ?? defaultBranding(),
        permissionCatalog: (kv.get("permission_catalog") as string[] | undefined) ?? undefined,
        roles: roles.length ? roles.map(mappers.roles.from) : defaultRoles(),
        users: users.map(mappers.users.from),
        alertSettings: { ...defaultAlertSettings(), ...(kv.get("alert_settings") as Partial<AlertSettings> | undefined) },
        alerts: alerts.map(mappers.alerts.from),
        dataSettings: { ...defaultDataSettings(), ...(kv.get("data_settings") as Partial<DataSettings> | undefined) },
        demoTagged: Boolean(kv.get("demo_tagged")),
        categories: categories.map(mappers.categories.from),
        suppliers: suppliers.map(mappers.suppliers.from),
        products: products.map(mappers.products.from),
        movements: movements.map(mappers.movements.from),
      };
    },

    async save(next, prev) {
      // Upsert new/changed rows, parents first.
      for (const key of UPSERT_ORDER) {
        const m = mappers[key];
        const before = new Map((prev?.[key] ?? []).map((x) => [x.id, JSON.stringify(x)]));
        const changed = (next[key] as { id: string }[]).filter((x) => before.get(x.id) !== JSON.stringify(x));
        for (const batch of chunks(changed)) {
          const { error } = await client.from(m.table).upsert(batch.map((x) => (m.to as (v: unknown) => Row)(x)));
          fail(`writing ${m.table}`, error);
        }
      }
      // Delete removed rows, children first. Without a previous snapshot, delete anything not in `next`.
      for (const key of [...UPSERT_ORDER].reverse()) {
        const m = mappers[key];
        const keep = new Set((next[key] as { id: string }[]).map((x) => x.id));
        const existing = prev ? prev[key].map((x) => x.id) : (await selectAll(client, m.table, "created_at")).map((r) => r.id as string);
        const removed = existing.filter((id) => !keep.has(id));
        for (const batch of chunks(removed)) {
          const { error } = await client.from(m.table).delete().in("id", batch);
          fail(`deleting from ${m.table}`, error);
        }
      }
      if (
        !prev || prev.version !== next.version || JSON.stringify(prev.branding) !== JSON.stringify(next.branding) ||
        JSON.stringify(prev.permissionCatalog) !== JSON.stringify(next.permissionCatalog) ||
        JSON.stringify(prev.alertSettings) !== JSON.stringify(next.alertSettings) ||
        JSON.stringify(prev.dataSettings) !== JSON.stringify(next.dataSettings) || prev.demoTagged !== next.demoTagged
      ) {
        const { error } = await client.from("app_settings").upsert([
          { key: "version", value: next.version },
          { key: "branding", value: next.branding },
          { key: "permission_catalog", value: next.permissionCatalog ?? [] },
          { key: "alert_settings", value: next.alertSettings },
          { key: "data_settings", value: next.dataSettings },
          { key: "demo_tagged", value: Boolean(next.demoTagged) },
        ]);
        fail("writing app_settings", error);
      }
      loadedAt = Date.now();
    },

    async isStale() {
      return Date.now() - loadedAt > STALE_AFTER_MS;
    },
  };
}
