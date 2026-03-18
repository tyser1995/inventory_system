-- =============================================================================
-- Inventory Management System — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ── 1. Users ─────────────────────────────────────────────────────────────────
-- Note: this is the app's own user table (not Supabase Auth).
-- Passwords are stored as SHA-256 hashes (hex string).

CREATE TABLE IF NOT EXISTS users (
  id                TEXT        PRIMARY KEY,
  username          TEXT        NOT NULL UNIQUE,
  email             TEXT        NOT NULL UNIQUE,
  role              TEXT        NOT NULL,             -- 'super_admin' | 'admin' | 'staff'
  password_hash     TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  custom_permissions TEXT        NULL                 -- JSON array of permission names, or NULL = use role defaults
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
  unit                TEXT        NULL,               -- e.g. 'pcs', 'kg', 'box'
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
  user_id    TEXT        NOT NULL,                    -- references users(id), no FK to allow flexibility
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
  id                TEXT  PRIMARY KEY,
  purchase_order_id TEXT  NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        TEXT  NOT NULL REFERENCES products(id),
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
  id            TEXT    PRIMARY KEY,
  sales_order_id TEXT   NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id    TEXT    NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL,
  unit_price    REAL    NOT NULL
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

-- =============================================================================
-- Indexes (performance)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_po_items_order       ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_order       ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse      ON product_warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_lookup_category      ON app_lookup(category);

-- =============================================================================
-- Seed: default lookup values
-- =============================================================================

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

-- =============================================================================
-- Seed: default Super Admin account (password: "admin" — SHA-256 hash)
-- Change the password immediately after first login via User Management.
-- =============================================================================

INSERT INTO users (id, username, email, role, password_hash, created_at)
VALUES (
  gen_random_uuid()::text,
  'superadmin',
  'superadmin@example.com',
  'super_admin',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', -- SHA-256 of "admin"
  NOW()
)
ON CONFLICT (username) DO NOTHING;
