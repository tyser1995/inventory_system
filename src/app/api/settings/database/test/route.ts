import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { testSupabase } from "@/lib/db/provider";
import { supabaseCredentialsSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await authorize("settings.database");
  const { url, serviceKey } = await parseBody(req, supabaseCredentialsSchema);
  return { ok: true, counts: await testSupabase(url, serviceKey) };
});
