-- StockVault inventory schema
create table if not exists categories (
  id uuid primary key,
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key,
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  unit text not null default 'pcs',
  cost_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_level integer not null default 0,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock_movements (
  id uuid primary key,
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('IN','OUT','ADJUST')),
  quantity integer not null,
  balance_after integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on stock_movements(product_id);
create index if not exists stock_movements_created_idx on stock_movements(created_at desc);

-- Added in v2: who recorded each movement (safe to re-run)
alter table stock_movements add column if not exists user_name text;

create table if not exists app_roles (
  id text primary key,
  name text not null unique,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role_id text not null references app_roles(id) on delete restrict,
  active boolean not null default true,
  session_version integer not null default 0,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Added in v3: stock alerts (product may be deleted later, so no foreign key)
create table if not exists app_alerts (
  id uuid primary key,
  kind text not null check (kind in ('low-stock','out-of-stock','restocked')),
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  quantity integer not null,
  min_level integer not null,
  unit text not null default 'pcs',
  created_at timestamptz not null default now(),
  read_by jsonb not null default '[]'::jsonb
);
create index if not exists app_alerts_created_idx on app_alerts(created_at desc);

-- Added in v4: demo (sample) record flag
alter table categories add column if not exists is_demo boolean not null default false;
alter table suppliers add column if not exists is_demo boolean not null default false;
alter table products add column if not exists is_demo boolean not null default false;
alter table stock_movements add column if not exists is_demo boolean not null default false;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

-- Lock tables down: the app connects with the service-role key (bypasses RLS),
-- so the public anon key gets no access.
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table app_settings enable row level security;
alter table app_roles enable row level security;
alter table app_users enable row level security;
alter table app_alerts enable row level security;
