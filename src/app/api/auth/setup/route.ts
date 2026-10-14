import { handle, parseBody } from "@/lib/api";
import { createFirstSuperadmin } from "@/lib/auth/accounts";
import { authForUser } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { audit } from "@/lib/logs/audit";
import { setupSchema } from "@/lib/validation";

/** One-time: creates the first Super Admin when no users exist, then signs them in. */
export const POST = handle(async (req: Request) => {
  const user = await createFirstSuperadmin(await parseBody(req, setupSchema));
  await setSessionCookie(user.id, user.sessionVersion, false);
  await audit({ action: "auth.setup", category: "auth", auth: await authForUser(user.id), details: "Created the first Super Admin", req });
  return { ok: true };
});
