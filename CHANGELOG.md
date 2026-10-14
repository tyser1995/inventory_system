# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] — 2026-10-14

### Added

- **Dev Mode (`NEXT_PUBLIC_DEV_MODE=true`)** — turns on the demo accounts below and adds a "Demo accounts" panel to the login page with one-click sign-in per role (Super Admin, Admin, Manager, Staff). The button signs in to the configured account on the server without a password check — so it also works for an account that already existed in `db.json` with a different password — and passwords never reach the browser. Deactivated accounts are still refused, last-login is updated and the audit log records "Demo sign-in (dev mode)". Maintenance Mode takes priority over Dev Mode. With Dev Mode off no demo accounts are created and demo sign-in returns 404. (`src/lib/modes.ts`, `src/app/api/auth/demo/route.ts`, `src/app/(auth)/login/page.tsx`)
- **Maintenance Mode (`NEXT_PUBLIC_MAINTENANCE_MODE=true`)** — every page redirects to a new `/maintenance` page and every API call answers `503` with a `Retry-After` header; only branding (the logo) stays available. When maintenance is off, `/maintenance` redirects home. (`src/proxy.ts`, `src/app/maintenance/page.tsx`)
- **Demo accounts from environment variables** — while Dev Mode is on, any configured account missing from the database (new or existing) is added automatically from `SUPERADMIN_*`, `ADMIN_*`, `MANAGER_*` and `STAFF_*` env vars, so a fresh deploy is usable without `/setup`. An account whose email already exists is left untouched (its password is not changed). Each account needs `<ROLE>_EMAIL` and `<ROLE>_PASSWORD` (min 8 characters); `<ROLE>_NAME` is optional. Passwords live only in the environment, never in the repository. The custom **Manager** role (view/create/edit products, record stock, view catalog) is created on first use. A missing or too-short value is logged and that account skipped — it never crashes the app. (`src/lib/db/demo-users.ts`, `src/lib/db/store.ts`)
- **`.env.example`** — documents every supported variable: `AUTH_SECRET`, the demo accounts, `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, and `INVENTORY_DATA_DIR`. Un-ignored in `.gitignore` so it is committed.
- **CHANGELOG.md** — this file.

### Fixed

- **Every API call on Vercel returned HTTP 500.** The app wrote its database, config, logs and backups to `data/` inside the project, which is read-only on Vercel. On Vercel the data folder now defaults to the system temp directory; `INVENTORY_DATA_DIR` still overrides it. (`src/lib/config.ts`, commit `41a3104`)
- **Concurrent requests could add the demo accounts twice.** Simultaneous requests each created their own copy of the demo accounts with different ids, which could sign a user out right after logging in. Database reloads are now shared by all in-flight requests. (`src/lib/db/store.ts`)

### Changed

- **Login no longer redirects to `/setup`.** An empty database used to send every visitor from the login page to first-run setup. The login page now always stays put; `/setup` is still reachable by opening it directly (it only works while there are no users). (`src/app/(auth)/login/page.tsx`)
- **Supabase selected by env vars.** With no saved config, setting both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` now selects Supabase; otherwise the local JSON database is used. (`src/lib/config.ts`, commit `41a3104`)

### Notes

- **Where data is stored.** Locally the app reads and writes `data/db.json` in the project folder — Dev Mode adds the demo accounts to that same file, and everything done while signed in as a demo account (products, stock movements, …) is saved there permanently. On Vercel the file is `<temp dir>/inventory-data/db.json`. `INVENTORY_DATA_DIR` overrides both.
- On Vercel the local database lives in temporary storage: changes made during a demo last until Vercel restarts the instance, then reset to the sample data plus the demo accounts.
- Set `AUTH_SECRET` on Vercel, otherwise each instance signs sessions with its own key and users can be signed out unexpectedly.

## [0.1.0] — 2026-10-14

Initial release (commit `c761553`): inventory system with products, categories, suppliers, stock movements, dashboard, users and roles, stock alerts, branding, backups, activity/error logs, and a choice of local JSON or Supabase storage.
