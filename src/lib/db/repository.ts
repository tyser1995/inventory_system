import "server-only";
import { stockStatus } from "../stock";
import type { AlertKind, AlertSettings, Branding, Category, Database, DashboardStats, Product, StockAlert, StockMovement, Supplier } from "../types";
import type {
  BrandingInput,
  CategoryInput, MovementInput, ProductInput, ProductUpdateInput, SupplierInput,
} from "../validation";
import { read, write } from "./store";

import { ConflictError, NotFoundError } from "../errors";

export { ConflictError, NotFoundError };

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function find<T extends { id: string }>(list: T[], id: string, label: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new NotFoundError(`${label} not found`);
  return item;
}

/* ───────────────────────── Stock alerts ───────────────────────── */

const MAX_ALERTS = 500;

/**
 * Raises an alert when a product crosses its minimum stock level.
 * `before` is the product's quantity/minimum prior to the change.
 */
function raiseAlert(db: Database, product: Product, before: { quantity: number; reorderLevel: number }) {
  if (!db.alertSettings.enabled) return;
  const prev = stockStatus(before);
  const next = stockStatus(product);
  if (prev === next) return;
  let kind: AlertKind | null = null;
  if (next === "out-of-stock") kind = "out-of-stock";
  else if (next === "low-stock" && prev === "in-stock") kind = "low-stock";
  else if (next === "in-stock" && db.alertSettings.notifyRestock) kind = "restocked";
  if (!kind) return;
  const alert: StockAlert = {
    id: uid(), kind, productId: product.id, productName: product.name, sku: product.sku, quantity: product.quantity,
    minLevel: product.reorderLevel, unit: product.unit, createdAt: now(), readBy: [],
  };
  db.alerts.unshift(alert);
  if (db.alerts.length > MAX_ALERTS) db.alerts.length = MAX_ALERTS;
}

export const alerts = {
  /** Latest alerts with a per-user read flag. */
  list: (userId: string, limit = 50) =>
    read((db) => {
      const hidden = new Set(db.dataSettings.demoEnabled ? [] : db.products.filter((p) => p.demo).map((p) => p.id));
      const visible = db.alerts.filter((a) => !hidden.has(a.productId));
      return {
        items: visible.slice(0, limit).map(({ readBy, ...a }) => ({ ...a, read: readBy.includes(userId) })),
        unread: visible.filter((a) => !a.readBy.includes(userId)).length,
      };
    }),

  markRead: (userId: string, ids?: string[]) =>
    write((db) => {
      let n = 0;
      for (const a of db.alerts) {
        if ((ids && !ids.includes(a.id)) || a.readBy.includes(userId)) continue;
        a.readBy.push(userId);
        n++;
      }
      return { updated: n };
    }),

  settings: () => read((db) => db.alertSettings),

  updateSettings: (input: AlertSettings) => write((db) => (db.alertSettings = { ...input })),
};

/* ───────────────────────── Branding ───────────────────────── */

export const branding = {
  get: () => read((db) => db.branding),

  update: (input: BrandingInput) =>
    write((db): Branding => {
      db.branding = { ...input, updatedAt: now() };
      return db.branding;
    }),
};

/* ───────────────────────── Active view (demo filter) ───────────────────────── */

/**
 * The records the app currently works with. While demo data is disabled, demo records
 * (and movements of demo products) are excluded from every list, total and action.
 */
function view(db: Readonly<Database>) {
  const on = db.dataSettings.demoEnabled;
  const keep = <T extends { demo?: boolean }>(list: T[]) => (on ? list : list.filter((x) => !x.demo));
  const products = keep(db.products);
  const ids = new Set(products.map((p) => p.id));
  const allIds = new Set(db.products.map((p) => p.id));
  return {
    products,
    categories: keep(db.categories),
    suppliers: keep(db.suppliers),
    // Keep movements of active products, plus orphans of deleted products.
    movements: keep(db.movements).filter((m) => ids.has(m.productId) || !allIds.has(m.productId)),
  };
}

/** Uniqueness is checked across all records (including disabled demo ones) to keep the data consistent. */
function conflictLabel(existing: { demo?: boolean }, what: string) {
  return existing.demo ? `${what} already exists in the demo data. Remove or rename it first.` : `${what} already exists`;
}

/* ───────────────────────── Categories ───────────────────────── */

export const categories = {
  list: () =>
    read((db) => {
      const v = view(db);
      return v.categories
        .map((c) => ({ ...c, productCount: v.products.filter((p) => p.categoryId === c.id).length }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),

  create: (input: CategoryInput) =>
    write((db) => {
      const dup = db.categories.find((c) => c.name.toLowerCase() === input.name.toLowerCase());
      if (dup) throw new ConflictError(conflictLabel(dup, "A category with this name"));
      const cat: Category = { id: uid(), ...input, createdAt: now() };
      db.categories.push(cat);
      return cat;
    }),

  update: (id: string, input: CategoryInput) =>
    write((db) => {
      const cat = find(view(db).categories, id, "Category");
      const dup = db.categories.find((c) => c.id !== id && c.name.toLowerCase() === input.name.toLowerCase());
      if (dup) throw new ConflictError(conflictLabel(dup, "A category with this name"));
      return Object.assign(cat, input);
    }),

  remove: (id: string) =>
    write((db) => {
      find(view(db).categories, id, "Category");
      db.categories = db.categories.filter((c) => c.id !== id);
      // Detach products rather than deleting them.
      for (const p of db.products) if (p.categoryId === id) p.categoryId = null;
    }),
};

/* ───────────────────────── Suppliers ───────────────────────── */

export const suppliers = {
  list: () =>
    read((db) => {
      const v = view(db);
      return v.suppliers
        .map((s) => ({ ...s, productCount: v.products.filter((p) => p.supplierId === s.id).length }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }),

  create: (input: SupplierInput) =>
    write((db) => {
      const sup: Supplier = { id: uid(), ...input, createdAt: now() };
      db.suppliers.push(sup);
      return sup;
    }),

  update: (id: string, input: SupplierInput) =>
    write((db) => Object.assign(find(view(db).suppliers, id, "Supplier"), input)),

  remove: (id: string) =>
    write((db) => {
      find(view(db).suppliers, id, "Supplier");
      db.suppliers = db.suppliers.filter((s) => s.id !== id);
      for (const p of db.products) if (p.supplierId === id) p.supplierId = null;
    }),
};

/* ───────────────────────── Products ───────────────────────── */

export const products = {
  list: () => read((db) => [...view(db).products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),

  get: (id: string) => read((db) => find(view(db).products, id, "Product")),

  create: (input: ProductInput, userName?: string) =>
    write((db) => {
      const dup = db.products.find((p) => p.sku.toLowerCase() === input.sku.toLowerCase());
      if (dup) throw new ConflictError(conflictLabel(dup, "SKU"));
      const ts = now();
      const product: Product = { id: uid(), ...input, createdAt: ts, updatedAt: ts };
      db.products.push(product);
      raiseAlert(db, product, { quantity: Number.MAX_SAFE_INTEGER, reorderLevel: 0 });
      if (product.quantity > 0) {
        db.movements.unshift({
          id: uid(), productId: product.id, type: "IN", quantity: product.quantity,
          balanceAfter: product.quantity, note: "Opening stock", userName, createdAt: ts,
        });
      }
      return product;
    }),

  update: (id: string, input: ProductUpdateInput) =>
    write((db) => {
      const product = find(view(db).products, id, "Product");
      const sku = input.sku?.toLowerCase();
      const dup = sku ? db.products.find((p) => p.id !== id && p.sku.toLowerCase() === sku) : undefined;
      if (dup) throw new ConflictError(conflictLabel(dup, "SKU"));
      const before = { quantity: product.quantity, reorderLevel: product.reorderLevel };
      Object.assign(product, input, { updatedAt: now() });
      raiseAlert(db, product, before);
      return product;
    }),

  /** Sets the minimum stock level for many products at once. */
  setMinStock: (opts: { minStock: number; categoryId?: string | null; scope: "all" | "category" }) =>
    write((db) => {
      const targets = view(db).products.filter(
        (p) => opts.scope === "all" || (p.categoryId ?? null) === (opts.categoryId ?? null),
      );
      for (const p of targets) {
        const before = { quantity: p.quantity, reorderLevel: p.reorderLevel };
        p.reorderLevel = opts.minStock;
        p.updatedAt = now();
        raiseAlert(db, p, before);
      }
      return { updated: targets.length, name: `${targets.length} products → min ${opts.minStock}` };
    }),

  remove: (id: string) =>
    write((db) => {
      find(view(db).products, id, "Product");
      db.products = db.products.filter((p) => p.id !== id);
      db.movements = db.movements.filter((m) => m.productId !== id);
    }),
};

/* ───────────────────────── Stock movements ───────────────────────── */

export const movements = {
  list: (limit = 200) =>
    read((db) => {
      const v = view(db);
      return v.movements.slice(0, limit).map((m) => {
        const p = db.products.find((x) => x.id === m.productId);
        return { ...m, productName: p?.name ?? "Deleted product", sku: p?.sku ?? "—" };
      });
    }),

  record: (input: MovementInput, userName?: string) =>
    write((db) => {
      const product = find(view(db).products, input.productId, "Product");
      const delta =
        input.type === "OUT" ? -Math.abs(input.quantity)
        : input.type === "IN" ? Math.abs(input.quantity)
        : input.quantity;
      const balance = product.quantity + delta;
      if (balance < 0)
        throw new ConflictError(`Insufficient stock — only ${product.quantity} ${product.unit} available`);
      const ts = now();
      const before = { quantity: product.quantity, reorderLevel: product.reorderLevel };
      product.quantity = balance;
      product.updatedAt = ts;
      const movement: StockMovement = {
        id: uid(), productId: product.id, type: input.type, quantity: delta,
        balanceAfter: balance, note: input.note, userName, createdAt: ts,
        // Movements on demo products are demo too, so they're disabled/removed with them.
        ...(product.demo ? { demo: true } : {}),
      };
      db.movements.unshift(movement);
      raiseAlert(db, product, before);
      return movement;
    }),
};

/* ───────────────────────── Demo data ───────────────────────── */

export const demoData = {
  status: () =>
    read((db) => ({
      enabled: db.dataSettings.demoEnabled,
      counts: {
        products: db.products.filter((p) => p.demo).length,
        categories: db.categories.filter((c) => c.demo).length,
        suppliers: db.suppliers.filter((s) => s.demo).length,
        movements: db.movements.filter((m) => m.demo).length,
      },
      realProducts: db.products.filter((p) => !p.demo).length,
    })),

  setEnabled: (enabled: boolean) =>
    write((db) => {
      db.dataSettings = { ...db.dataSettings, demoEnabled: enabled };
      return { enabled, name: enabled ? "Demo data enabled" : "Demo data disabled" };
    }),

  /** Permanently deletes every demo record; your own records stay (links to demo categories/suppliers are cleared). */
  remove: () =>
    write((db) => {
      const demoProducts = new Set(db.products.filter((p) => p.demo).map((p) => p.id));
      const demoCats = new Set(db.categories.filter((c) => c.demo).map((c) => c.id));
      const demoSups = new Set(db.suppliers.filter((s) => s.demo).map((s) => s.id));
      const removed = demoProducts.size + demoCats.size + demoSups.size;
      db.products = db.products.filter((p) => !p.demo);
      for (const p of db.products) {
        if (p.categoryId && demoCats.has(p.categoryId)) p.categoryId = null;
        if (p.supplierId && demoSups.has(p.supplierId)) p.supplierId = null;
      }
      db.categories = db.categories.filter((c) => !c.demo);
      db.suppliers = db.suppliers.filter((s) => !s.demo);
      db.movements = db.movements.filter((m) => !m.demo && !demoProducts.has(m.productId));
      db.alerts = db.alerts.filter((a) => !demoProducts.has(a.productId));
      return { removed, name: `${removed} demo records removed` };
    }),

  /** Loads the sample dataset next to your data (skips anything whose SKU or category name already exists). */
  add: (sample: Pick<Database, "categories" | "suppliers" | "products" | "movements">) =>
    write((db) => {
      if (db.products.some((p) => p.demo)) throw new ConflictError("Demo data is already loaded");
      const catNames = new Set(db.categories.map((c) => c.name.toLowerCase()));
      const skus = new Set(db.products.map((p) => p.sku.toLowerCase()));
      const cats = sample.categories.filter((c) => !catNames.has(c.name.toLowerCase()));
      const keptCatIds = new Set(cats.map((c) => c.id));
      const prods = sample.products
        .filter((p) => !skus.has(p.sku.toLowerCase()))
        .map((p) => ({ ...p, categoryId: p.categoryId && keptCatIds.has(p.categoryId) ? p.categoryId : null }));
      const prodIds = new Set(prods.map((p) => p.id));
      db.categories.push(...cats);
      db.suppliers.push(...sample.suppliers);
      db.products.push(...prods);
      db.movements = [...db.movements, ...sample.movements.filter((m) => prodIds.has(m.productId))].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      db.dataSettings = { ...db.dataSettings, demoEnabled: true };
      return { added: prods.length, name: `${prods.length} demo products added` };
    }),
};

/* ───────────────────────── Dashboard ───────────────────────── */

const TREND_DAYS = 14;

export const stats = (): Promise<DashboardStats> =>
  read((db) => {
    const v = view(db);
    const items = v.products;
    const withName = (m: StockMovement) => {
      const p = db.products.find((x) => x.id === m.productId);
      return { ...m, productName: p?.name ?? "Deleted product", sku: p?.sku ?? "—" };
    };

    const byCat = new Map<string | null, { value: number; units: number }>();
    for (const p of items) {
      const cur = byCat.get(p.categoryId) ?? { value: 0, units: 0 };
      cur.value += p.quantity * p.costPrice;
      cur.units += p.quantity;
      byCat.set(p.categoryId, cur);
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (TREND_DAYS - 1));
    const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d.toISOString(), in: 0, out: 0 };
    });
    for (const m of v.movements) {
      const idx = Math.floor((new Date(m.createdAt).getTime() - start.getTime()) / 86_400_000);
      if (idx < 0 || idx >= TREND_DAYS) continue;
      if (m.quantity > 0) trend[idx].in += m.quantity;
      else trend[idx].out -= m.quantity;
    }

    return {
      totalProducts: items.length,
      totalUnits: items.reduce((s, p) => s + p.quantity, 0),
      inventoryValue: items.reduce((s, p) => s + p.quantity * p.costPrice, 0),
      retailValue: items.reduce((s, p) => s + p.quantity * p.sellPrice, 0),
      lowStockCount: items.filter((p) => p.quantity > 0 && p.quantity <= p.reorderLevel).length,
      outOfStockCount: items.filter((p) => p.quantity <= 0).length,
      categoryBreakdown: [...byCat.entries()]
        .map(([id, val]) => ({ id, name: db.categories.find((c) => c.id === id)?.name ?? "Uncategorized", ...val }))
        .sort((a, b) => b.value - a.value),
      movementTrend: trend,
      lowStock: items
        .filter((p) => p.quantity <= p.reorderLevel)
        .sort((a, b) => a.quantity - a.reorderLevel - (b.quantity - b.reorderLevel))
        .slice(0, 6),
      recentMovements: v.movements.slice(0, 8).map(withName),
    };
  });
