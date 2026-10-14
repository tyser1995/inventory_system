import { handle } from "@/lib/api";
import { getAuth } from "@/lib/auth/guard";
import { clearSessionCookie } from "@/lib/auth/session";
import { audit } from "@/lib/logs/audit";

export const POST = handle(async (req: Request) => {
  const auth = await getAuth();
  if (auth) await audit({ action: "auth.logout", category: "auth", auth, req });
  await clearSessionCookie();
  return { ok: true };
});
