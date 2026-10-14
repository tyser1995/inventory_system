import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { getConfig, publicConfig } from "@/lib/config";
import { SUPABASE_SCHEMA_SQL } from "@/lib/db/adapters/supabase-schema";
import { snapshot } from "@/lib/db/store";

export const GET = handle(async () => {
  await authorize("settings.database");
  const config = publicConfig(await getConfig());
  let counts: Record<string, number> | null = null;
  let error: string | null = null;
  try {
    const db = await snapshot();
    counts = { products: db.products.length, categories: db.categories.length, suppliers: db.suppliers.length, movements: db.movements.length };
  } catch (e) {
    error = (e as Error).message;
  }
  return { provider: config.provider, supabase: config.supabase, counts, error, schemaSql: SUPABASE_SCHEMA_SQL };
});
