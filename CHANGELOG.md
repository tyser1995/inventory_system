# Changelog

All notable changes to StockVault are recorded here, newest first.

## 2026-10-14 — Demo accounts from an environment variable

Lets the Vercel deployment boot with ready-made logins while keeping the local JSON
database and without committing any passwords to the repository.

### Added
- `DEMO_USERS` environment variable (`src/lib/db/demo-users.ts`). When a brand-new database
  is created, the accounts listed in it are added automatically, so the app goes straight to
  the login page instead of `/setup`. Format is a JSON array:
  ```json
  [{"name":"Sam Staff","email":"staff@example.com","password":"min-8-chars","role":"staff"},
   {"name":"Morgan Manager","email":"manager@example.com","password":"min-8-chars","role":"Manager",
    "permissions":["dashboard.view","products.view","products.create","products.edit",
                   "movements.view","stock.record","categories.view","suppliers.view"]}]
  ```
  - `role` matches a built-in role by id or name (`superadmin`, `admin`, `staff`).
  - A role that doesn't exist yet (e.g. `Manager`) is created when `permissions` are given;
    unknown permission keys are ignored.
  - Invalid JSON or an unknown role without permissions is logged and skipped — it never
    crashes the app.

### Fixed
- Concurrent first requests on a cold start now share a single seed, so two requests can't
  create different copies of the demo accounts (which would sign users out right after login).

### Notes
- On Vercel the database lives in temporary storage: changes made during a demo last until
  Vercel restarts the instance, then the data resets to the sample data plus `DEMO_USERS`.
- Set `AUTH_SECRET` in Vercel as well, otherwise each instance signs sessions with its own key
  and users can be signed out unexpectedly.

## 2026-10-14 — Run on Vercel without a writable project folder

Commit `41a3104`.

### Fixed
- Every API call on Vercel returned HTTP 500. The app wrote its database, config, logs and
  backups to `data/` inside the project, which is read-only on Vercel. On Vercel the data
  folder now defaults to the system temp directory (`INVENTORY_DATA_DIR` still overrides it).

### Changed
- When there is no saved config, setting both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  selects Supabase as the database; otherwise the local JSON database is used.

## 2026-10-14 — Initial release

Commit `c761553`. Inventory system with products, categories, suppliers, stock movements,
dashboard, users and roles, stock alerts, branding, backups, activity/error logs, and a choice
of local JSON or Supabase storage.
