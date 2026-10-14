import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { getConfig, publicConfig } from "@/lib/config";
import { saveSupabaseCredentials } from "@/lib/db/provider";
import { supabaseCredentialsSchema } from "@/lib/validation";

export const PUT = handle(async (req: Request) => {
  await authorize("settings.database");
  const { url, serviceKey } = await parseBody(req, supabaseCredentialsSchema);
  await saveSupabaseCredentials(url, serviceKey);
  return publicConfig(await getConfig()).supabase;
});
