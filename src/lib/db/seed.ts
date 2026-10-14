import { SYSTEM_ROLE_DEFAULTS } from "../auth/permissions";
import type { AlertSettings, Branding, DataSettings, Category, Database, Product, Role, StockMovement, Supplier } from "../types";

export const defaultBranding = (): Branding => ({
  appName: "StockVault",
  tagline: "Inventory Suite",
  logo: null,
  updatedAt: new Date(0).toISOString(),
});

const DAY = 86_400_000;

export const defaultAlertSettings = (): AlertSettings => ({ enabled: true, notifyRestock: true, defaultMinStock: 5 });

export const defaultDataSettings = (): DataSettings => ({ demoEnabled: true });

export const defaultRoles = (): Role[] =>
  SYSTEM_ROLE_DEFAULTS.map((r) => ({ ...r, permissions: [...r.permissions], system: true, createdAt: new Date(0).toISOString() }));

export function createSeed(version: number): Database {
  const now = Date.now();
  const iso = (offsetDays = 0) => new Date(now - offsetDays * DAY).toISOString();
  const id = () => crypto.randomUUID();

  const cat = (name: string, description: string): Category => ({ id: id(), name, description, createdAt: iso(30), demo: true });
  const categories = [
    cat("Processors", "Desktop & server CPUs"),
    cat("Graphics Cards", "Discrete GPUs"),
    cat("Memory", "DDR4 / DDR5 RAM kits"),
    cat("Storage", "SSDs, NVMe & HDDs"),
    cat("Motherboards", "ATX, mATX & ITX boards"),
    cat("Peripherals", "Keyboards, mice & monitors"),
  ];
  const [cpu, gpu, ram, ssd, mobo, peri] = categories;

  const sup = (name: string, email: string, phone: string, address: string): Supplier => ({
    id: id(), name, email, phone, address, createdAt: iso(30), demo: true,
  });
  const suppliers = [
    sup("Atlas Components", "orders@atlas.example", "+1 555 0101", "Austin, TX"),
    sup("Northwind Tech Supply", "sales@northwind.example", "+1 555 0144", "Seattle, WA"),
    sup("Goldline Distribution", "hello@goldline.example", "+1 555 0190", "Phoenix, AZ"),
  ];
  const [atlas, northwind, goldline] = suppliers;

  type Row = [string, string, Category, Supplier, number, number, number, number, string];
  const rows: Row[] = [
    ["CPU-R9-7950X", "Ryzen 9 7950X", cpu, atlas, 489, 579, 14, 5, "A1-01"],
    ["CPU-R7-7800X3D", "Ryzen 7 7800X3D", cpu, atlas, 329, 399, 4, 6, "A1-02"],
    ["CPU-I9-14900K", "Core i9-14900K", cpu, northwind, 459, 549, 9, 5, "A1-03"],
    ["CPU-I5-14600K", "Core i5-14600K", cpu, northwind, 249, 299, 22, 8, "A1-04"],
    ["GPU-RTX4090", "GeForce RTX 4090 24GB", gpu, goldline, 1599, 1899, 3, 2, "B2-01"],
    ["GPU-RTX4070S", "GeForce RTX 4070 Super", gpu, goldline, 549, 649, 11, 4, "B2-02"],
    ["GPU-RX7900XT", "Radeon RX 7900 XT", gpu, atlas, 649, 749, 0, 3, "B2-03"],
    ["RAM-D5-32-6000", "DDR5 32GB (2x16) 6000MHz", ram, northwind, 89, 119, 48, 15, "C1-01"],
    ["RAM-D5-64-6400", "DDR5 64GB (2x32) 6400MHz", ram, northwind, 179, 229, 12, 6, "C1-02"],
    ["RAM-D4-16-3200", "DDR4 16GB (2x8) 3200MHz", ram, goldline, 34, 49, 7, 10, "C1-03"],
    ["SSD-NVME-2TB", "NVMe Gen4 SSD 2TB", ssd, atlas, 119, 159, 36, 12, "C2-01"],
    ["SSD-NVME-4TB", "NVMe Gen4 SSD 4TB", ssd, atlas, 229, 299, 8, 5, "C2-02"],
    ["HDD-8TB-7200", "HDD 8TB 7200RPM", ssd, goldline, 139, 179, 2, 4, "C2-03"],
    ["MB-X670E-ATX", "X670E ATX Motherboard", mobo, northwind, 289, 349, 10, 4, "D1-01"],
    ["MB-Z790-ATX", "Z790 ATX Motherboard", mobo, northwind, 259, 319, 6, 4, "D1-02"],
    ["MB-B650-ITX", "B650 Mini-ITX Motherboard", mobo, atlas, 179, 229, 5, 3, "D1-03"],
    ["PER-KB-75", "75% Mechanical Keyboard", peri, goldline, 79, 129, 27, 10, "E1-01"],
    ["PER-MS-WL", "Wireless Gaming Mouse", peri, goldline, 49, 89, 41, 12, "E1-02"],
    ["PER-MON-27QHD", '27" QHD 165Hz Monitor', peri, atlas, 229, 299, 9, 4, "E1-03"],
  ];

  const products: Product[] = rows.map(([sku, name, c, s, cost, sell, qty, reorder, location]) => ({
    id: id(), sku, name, categoryId: c.id, supplierId: s.id, unit: "pcs",
    costPrice: cost, sellPrice: sell, quantity: qty, reorderLevel: reorder, location,
    createdAt: iso(30), updatedAt: iso(1), demo: true,
  }));

  // Back-fill a believable 14-day movement history ending at current quantities.
  const movements: StockMovement[] = [];
  let seed = 42;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const p of products) {
    let balance = p.quantity;
    const history: StockMovement[] = [];
    const count = 2 + Math.floor(rand() * 4);
    // Offsets sorted newest-first so we can walk the ledger backwards.
    const offsets = Array.from({ length: count }, () => Math.floor(rand() * 14 * DAY)).sort((a, b) => a - b);
    for (let i = 0; i < count; i++) {
      // Walking backwards in time: an IN can't exceed the balance it produced.
      const isIn = rand() > 0.55 && balance > 0;
      const qty = isIn ? 1 + Math.floor(rand() * Math.min(12, balance)) : 1 + Math.floor(rand() * 6);
      history.push({
        id: id(), productId: p.id, type: isIn ? "IN" : "OUT",
        quantity: isIn ? qty : -qty, balanceAfter: balance,
        note: isIn ? "Supplier delivery" : "Customer order",
        createdAt: new Date(now - offsets[i]).toISOString(),
        demo: true,
      });
      balance -= isIn ? qty : -qty;
    }
    movements.push(...history);
  }
  movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    version, branding: defaultBranding(), roles: defaultRoles(), users: [], alertSettings: defaultAlertSettings(), alerts: [],
    dataSettings: defaultDataSettings(), demoTagged: true,
    categories, suppliers, products, movements,
  };
}
