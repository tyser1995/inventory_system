/**
 * Deployment-wide switches, read from env vars. NEXT_PUBLIC_* values are inlined at build
 * time, so changing one on Vercel needs a redeploy.
 */

/** Creates the demo accounts from env (SUPERADMIN_*, ADMIN_*, MANAGER_*, STAFF_*); sign in with their email and password. */
export const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

/** Sends every page to /maintenance and answers API calls with 503. */
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
