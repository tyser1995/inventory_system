# Inventory Management System

A full-featured, offline-first inventory management system built with Flutter. Supports local SQLite storage with optional Supabase cloud sync, Clean Architecture, Riverpod state management, and a responsive Material 3 admin-panel UI.

---

## Features

### Core Inventory
- **Dashboard** — KPI cards (total products, low-stock count, stock value) with live low-stock alerts
- **Products** — Full CRUD with paginated table, column sorting, debounced search, category filter, and unit of measure
- **Categories** — CRUD via inline dialogs
- **Transactions** — Stock-in / stock-out recording with paginated history and type filter

### Orders & Procurement
- **Purchase Orders** — Full PO lifecycle: Draft → Sent → Received (auto-stocks inventory on receive). Includes line items with product, quantity, and unit cost
- **Suppliers** — CRUD for supplier contacts and details, linked to purchase orders
- **Sales Orders** — Multichannel order management (retail, online, wholesale, B2B, etc.). Status workflow: Pending → Processing → Completed (auto-deducts stock). Supports cancel

### Warehouses
- **Multi-Warehouse** — Track stock levels per warehouse
- **Stock Transfers** — Move stock between warehouses
- **Default Warehouse** — Configurable default for transactions

### Analytics
- **Reports** — Transaction trend line chart, stock-by-category bar chart, sales-by-channel pie chart, and volume forecast table

### User Management
- **Role-Based Access** — Three roles: Super Admin, Admin, Staff
- **Custom Permissions** — Per-user permission overrides on top of role defaults
- **User Management** — Create, edit, delete users (admin and above)

### Settings & Config
- **Theme** — Light / Dark / System
- **Data Source** — Toggle between local SQLite and Supabase at runtime
- **Supabase Config** — Enter URL and anon key in-app
- **Backup & Restore** — Export all data to JSON; import from file picker
- **Scheduled Backups** — Configure multiple daily backup times
- **Dynamic Dropdowns** — Manage sales channels and units of measure via Settings > Manage Lists

### UX
- **Responsive Layout** — NavigationRail on tablet/desktop, BottomNavigationBar on mobile
- **Responsive Tables** — DataTable on wide screens; card list on narrow screens (breakpoint: 650 px)
- **Full-Width Tables** — Tables always fill available width, scrolling horizontally only when needed
- **Dark Mode Safe** — All colors use Material 3 `ColorScheme` tokens

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Flutter (stable 3.x) |
| Language | Dart 3.x |
| State Management | Riverpod 2.x (`Notifier`, `AsyncNotifier`, `FutureProvider`) |
| Routing | go_router 14.x |
| Local Database | Drift 2.x (SQLite via `drift_flutter`) |
| Remote Backend | Supabase (switchable at runtime) |
| Charts | fl_chart |
| UI | Material 3 |

---

## Architecture

Clean Architecture with three layers:

```
lib/
├── core/                   # Constants, permissions, theme
├── domain/
│   ├── entities/           # User, Product, Category, InventoryTransaction,
│   │                         PurchaseOrder, SalesOrder, Supplier, Warehouse, AppLookup
│   └── repositories/       # Abstract repository interfaces
├── data/
│   ├── local/
│   │   ├── database/       # Drift schema (AppDatabase, v4)
│   │   └── dao/            # UserDao, ProductDao, CategoryDao, TransactionDao,
│   │                         PurchaseOrderDao, SalesOrderDao, SupplierDao,
│   │                         WarehouseDao, LookupDao
│   └── repositories/       # Local implementations of domain repositories
├── presentation/
│   ├── providers/          # Riverpod notifiers and providers
│   ├── screens/            # Auth, Dashboard, Products, Categories, Transactions,
│   │                         PurchaseOrders, SalesOrders, Suppliers, Warehouses,
│   │                         Reports, Users, Settings
│   └── widgets/
│       ├── common/         # AppShell, ConfirmDialog, DebouncedSearchField
│       └── tables/         # AppPaginatedTable<T>, AppTableCard, AppCardField
└── config/                 # GoRouter with auth redirect and permission guards
```

---

## Database Schema

| Version | Changes |
|---|---|
| v1 | UsersTable, ProductsTable, CategoriesTable, TransactionsTable, SettingsTable |
| v2 | Added `customPermissions` to UsersTable |
| v3 | Added SuppliersTable, PurchaseOrdersTable, PurchaseOrderItemsTable, WarehousesTable, WarehouseStockTable, SalesOrdersTable, SalesOrderItemsTable |
| v4 | Added AppLookupTable (dynamic dropdowns); added `unit` column to ProductsTable |

---

## Roles & Permissions

| Role | Access |
|---|---|
| **Super Admin** | Full access — settings, DB switching, backup, user management |
| **Admin** | Inventory CRUD, purchase/sales orders, user management, limited settings |
| **Staff** | View products & transactions, record stock movements |

Custom permission overrides can be set per user by an admin.

---

## Responsive Tables

All list screens use `AppPaginatedTable<T>` (paginated) or inline `LayoutBuilder` (non-paginated):

- **Wide screen** — `DataTable` with full-width stretch, styled header, consistent row height
- **Narrow screen** (<650 px) — `ListView` of `AppTableCard` cards with `AppCardField` rows
- Pagination: 10 / 25 / 50 rows per page with prev/next navigation
- Column sorting, debounced search, category/type filters

---

## Dynamic Dropdowns

Sales channels and units of measure are stored in `AppLookupTable` and managed in **Settings → Manage Lists**:

- Add, edit, or delete entries without a code change
- Seeded defaults: `retail`, `online`, `wholesale`, `b2b`, `direct`, `other` (channels); `pcs`, `box`, `kg`, `ltr`, `mtr`, `pair` (UoM)
- Product form and sales order form read from the database at runtime

---

## Getting Started

### Prerequisites

- Flutter SDK (stable channel, 3.x)
- Chrome (for web target) or Android / iOS device / Windows desktop

### Run

```bash
# Install dependencies
flutter pub get

# Generate Drift database code and Riverpod providers
dart run build_runner build --delete-conflicting-outputs

# Run on Chrome
flutter run -d chrome

# Run on Windows desktop
flutter run -d windows
```

### Web assets (already committed)

Required files for Drift's WASM SQLite on web:

| File | Purpose |
|---|---|
| `web/sqlite3.wasm` | SQLite compiled to WebAssembly |
| `web/drift_worker.dart.js` | Compiled Dart web worker for Drift |

To recompile the worker after a Drift version update:

```bash
dart compile js -O2 -o web/drift_worker.dart.js web/drift_worker.dart
```

---

## Supabase Setup (optional)

To use Supabase as the backend, run the migration SQL in your Supabase project:

**Supabase Dashboard → SQL Editor → New Query → paste → Run**

The full script is at [`scripts/supabase_migration.sql`](scripts/supabase_migration.sql).

It creates all 13 tables, indexes, and seeds the default lookup values and a Super Admin account.

```sql
-- ── 1. Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT        PRIMARY KEY,
  username           TEXT        NOT NULL UNIQUE,
  email              TEXT        NOT NULL UNIQUE,
  role               TEXT        NOT NULL,            -- 'super_admin' | 'admin' | 'staff'
  password_hash      TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  custom_permissions TEXT        NULL                 -- JSON array of permission names, or NULL
);

-- ── 2. Categories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT        PRIMARY KEY,
  name                TEXT        NOT NULL,
  description         TEXT        NULL,
  category_id         TEXT        NOT NULL REFERENCES categories(id),
  price               REAL        NOT NULL,
  quantity            INTEGER     NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER     NOT NULL DEFAULT 10,
  sku                 TEXT        NULL,
  unit                TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Transactions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT        PRIMARY KEY,
  product_id TEXT        NOT NULL REFERENCES products(id),
  type       TEXT        NOT NULL,                    -- 'stock_in' | 'stock_out'
  quantity   INTEGER     NOT NULL,
  notes      TEXT        NULL,
  user_id    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Settings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── 6. Suppliers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  contact_name TEXT        NULL,
  email        TEXT        NULL,
  phone        TEXT        NULL,
  address      TEXT        NULL,
  notes        TEXT        NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. Purchase Orders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          TEXT        PRIMARY KEY,
  supplier_id TEXT        NOT NULL REFERENCES suppliers(id),
  status      TEXT        NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent' | 'received' | 'cancelled'
  total       REAL        NOT NULL DEFAULT 0,
  notes       TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. Purchase Order Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                TEXT    PRIMARY KEY,
  purchase_order_id TEXT    NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        TEXT    NOT NULL REFERENCES products(id),
  quantity          INTEGER NOT NULL,
  unit_cost         REAL    NOT NULL
);

-- ── 9. Warehouses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  address    TEXT        NULL,
  notes      TEXT        NULL,
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 10. Product Warehouse Stock ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_warehouse_stock (
  product_id   TEXT        NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  warehouse_id TEXT        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, warehouse_id)
);

-- ── 11. Sales Orders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
  id            TEXT        PRIMARY KEY,
  customer_name TEXT        NULL,
  channel       TEXT        NOT NULL,                 -- 'retail' | 'online' | 'wholesale' | 'b2b' | etc.
  status        TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'cancelled'
  total         REAL        NOT NULL DEFAULT 0,
  notes         TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 12. Sales Order Items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order_items (
  id             TEXT    PRIMARY KEY,
  sales_order_id TEXT    NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id     TEXT    NOT NULL REFERENCES products(id),
  quantity       INTEGER NOT NULL,
  unit_price     REAL    NOT NULL
);

-- ── 13. App Lookups (dynamic dropdowns) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_lookup (
  id         TEXT        PRIMARY KEY,
  category   TEXT        NOT NULL,                   -- 'sales_channel' | 'unit_of_measure'
  label      TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_po_items_order       ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_order       ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse      ON product_warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_lookup_category      ON app_lookup(category);

-- ── Seed: default lookup values ───────────────────────────────────────────────
INSERT INTO app_lookup (id, category, label, value, sort_order, is_active, created_at)
VALUES
  (gen_random_uuid()::text, 'sales_channel',   'Retail',    'retail',    0, TRUE, NOW()),
  (gen_random_uuid()::text, 'sales_channel',   'Online',    'online',    1, TRUE, NOW()),
  (gen_random_uuid()::text, 'sales_channel',   'Wholesale', 'wholesale', 2, TRUE, NOW()),
  (gen_random_uuid()::text, 'sales_channel',   'B2B',       'b2b',       3, TRUE, NOW()),
  (gen_random_uuid()::text, 'sales_channel',   'Direct',    'direct',    4, TRUE, NOW()),
  (gen_random_uuid()::text, 'sales_channel',   'Other',     'other',     5, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Piece',     'pcs',       0, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Box',       'box',       1, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Kg',        'kg',        2, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Liter',     'ltr',       3, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Meter',     'mtr',       4, TRUE, NOW()),
  (gen_random_uuid()::text, 'unit_of_measure', 'Pair',      'pair',      5, TRUE, NOW())
ON CONFLICT DO NOTHING;

-- ── Seed: default Super Admin (password: "admin") ────────────────────────────
INSERT INTO users (id, username, email, role, password_hash, created_at)
VALUES (
  gen_random_uuid()::text,
  'admin',
  'admin@example.com',
  'super_admin',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  NOW()
)
ON CONFLICT (username) DO NOTHING;
```

After running the migration:

1. Go to **Settings** in the app
2. Enable **Use Supabase (Online Mode)**
3. Enter your **Supabase URL** and **Anon Key**
4. Restart or hot-restart the app

> The app uses its own `users` table for authentication (not Supabase Auth). Passwords are stored as SHA-256 hex hashes.

---

## Default Credentials

Seeded automatically on first run:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |
| Role | Super Admin |

> Change the password immediately after first login via User Management.

---

## Backup & Restore

- **Export** — Dumps all tables to a timestamped JSON file saved to the app documents directory
- **Import** — Loads a JSON backup file via the file picker
- **Scheduled Backups** — Configure multiple daily backup times in Settings (runs while app is in foreground)
