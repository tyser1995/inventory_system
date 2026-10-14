import "server-only";
import { revalidateTag } from "next/cache";
import { safetyBackup } from "../backup/service";
import { BRANDING_TAG } from "../branding";
import { getConfig, supabaseCredentials, updateConfig, type Provider } from "../config";
import { BadRequestError } from "../errors";
import { checkSupabase } from "./adapters/supabase";
import { createAdapter, resetStore, snapshot } from "./store";

/** Tests credentials (falls back to the saved key when none is given). Returns row counts per table. */
export async function testSupabase(url: string, serviceKey?: string) {
  const key = serviceKey || supabaseCredentials(await getConfig()).serviceKey;
  if (!key) throw new BadRequestError("Enter the service_role key");
  return checkSupabase(url, key);
}

export async function saveSupabaseCredentials(url: string, serviceKey?: string) {
  const config = await getConfig();
  if (supabaseCredentials(config).fromEnv) throw new BadRequestError("Credentials are set by environment variables");
  if (!serviceKey && !config.supabase.serviceKey) throw new BadRequestError("Enter the service_role key");
  await updateConfig((c) => {
    c.supabase.url = url.replace(/\/+$/, "");
    if (serviceKey) c.supabase.serviceKey = serviceKey;
  });
  // If Supabase is active, the next access reconnects with the new credentials.
  await resetStore();
}

/**
 * Switches the active database.
 * - migrate: copies the current dataset into the target (replacing what's there)
 * - existing: starts using whatever the target already contains
 * A safety backup of the current data is always attempted first (if enabled).
 */
export async function switchProvider(target: Provider, mode: "migrate" | "existing") {
  const config = await getConfig();
  if (config.provider === target) throw new BadRequestError(`Already using ${target === "local" ? "the local database" : "Supabase"}`);

  const targetConfig = { ...config, provider: target };
  const targetAdapter = await createAdapter(targetConfig);
  if (target === "supabase") {
    const { url, serviceKey } = supabaseCredentials(config);
    await checkSupabase(url, serviceKey); // fail fast before touching anything
  }

  await safetyBackup(`Before switching to ${target}`);

  let copied = 0;
  if (mode === "migrate") {
    const data = await snapshot();
    await targetAdapter.save(data, null);
    copied = data.products.length;
  }

  await updateConfig((c) => void (c.provider = target));
  await resetStore();
  revalidateTag(BRANDING_TAG, { expire: 0 });
  return { provider: target, copiedProducts: copied };
}
