# Inventory Management System

A full-featured, offline-first inventory management system built with Flutter. Supports local SQLite storage with optional Supabase cloud sync, Clean Architecture, Riverpod state management, and a responsive UI.

---

## Features

### Core Inventory
- **Dashboard** — KPI cards (total products, low-stock count, stock value) with live low-stock alerts and quick-access links
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
- **Theme** — Light / Dark / System (defaults to Light)
- **Data Source** — Toggle between local SQLite and Supabase at runtime
- **Supabase Config** — Enter URL and anon key in-app (or via `.env`)
- **Backup & Restore** — Export all data to JSON; import from file picker
- **Scheduled Backups** — Configure multiple daily backup times
- **Dynamic Dropdowns** — Manage sales channels and units of measure via Settings > Manage Lists

### UX
- **Responsive Layout** — Fixed side nav (220 px) on desktop/tablet, bottom navigation bar on mobile
- **Responsive Tables** — DataTable on wide screens; card list on narrow screens (breakpoint: 650 px)
- **Design System** — Indigo/Inter flat-card design (mirrors attendance_tracker)

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
| UI | Material 3 + Google Fonts (Inter) |

---

## Architecture

Clean Architecture with three layers:

```
lib/
├── core/                   # Constants, permissions, theme (AppColors)
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
│   └── repositories/       # Local + Supabase implementations
├── presentation/
│   ├── providers/          # Riverpod notifiers and providers
│   ├── screens/            # Auth, Dashboard, Products, Categories, Transactions,
│   │                         PurchaseOrders, SalesOrders, Suppliers, Warehouses,
│   │                         Reports, Users, Settings
│   └── widgets/
│       ├── common/         # AppShell, KpiCard, ConfirmDialog, DebouncedSearchField
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

## Getting Started

### Prerequisites

- Flutter SDK (stable channel, 3.x)
- Chrome (for web target) or Windows desktop

### Environment Setup

```bash
cp .env.example .env
# Edit .env and fill in your Supabase credentials if using remote mode
```

### Install & Generate

```bash
# Install dependencies
flutter pub get

# Generate Drift database code and Riverpod providers
dart run build_runner build --delete-conflicting-outputs
```

### Run

```bash
# Web — default port 8080, falls back to dynamic port if 8080 is taken
bash run.sh

# Web — release build
bash run.sh --release

# Windows desktop
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

## Default Credentials

Seeded automatically on first run:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |
| Role | Super Admin |

> Change the password immediately after first login via User Management.

---

## Supabase Setup (optional)

To use Supabase as the backend, run the migration SQL in your Supabase project:

**Supabase Dashboard → SQL Editor → New Query → paste → Run**

The full script is at [`scripts/supabase_migration.sql`](scripts/supabase_migration.sql).

It creates all 13 tables, indexes, and seeds the default lookup values and a Super Admin account.

After running the migration:

1. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key
2. Go to **Settings** in the app
3. Enable **Use Supabase (Online Mode)**
4. Restart or hot-restart the app

> The app uses its own `users` table for authentication (not Supabase Auth). Passwords are stored as bcrypt hashes.

---

## Backup & Restore

- **Export** — Dumps all tables to a timestamped JSON file saved to the app documents directory
- **Import** — Loads a JSON backup file via the file picker
- **Scheduled Backups** — Configure multiple daily backup times in Settings (runs while app is in foreground)
