/**
 * Deployment-wide switches, read from env vars. NEXT_PUBLIC_* values are inlined at build
 * time, so changing one on Vercel needs a redeploy.
 */

/** Seeds demo accounts from env and shows one-click demo sign-in on the login page. Never enable with real data. */
export const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

/** Sends every page to /maintenance and answers API calls with 503. */
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
