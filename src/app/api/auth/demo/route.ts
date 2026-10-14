import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { loginDemoAccount } from "@/lib/auth/accounts";
import { authForUser } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { DEMO_ACCOUNT_KEYS, demoAccounts } from "@/lib/db/demo-users";
import { NotFoundError } from "@/lib/errors";
import { audit } from "@/lib/logs/audit";

/** Public, dev mode only: the demo accounts the login page can offer (never their passwords). */
export const GET = handle(async () => demoAccounts().map(({ key, label, name, email }) => ({ key, label, name, email })));

const demoLoginSchema = z.object({ account: z.enum(DEMO_ACCOUNT_KEYS) });

/**
 * Dev mode only: one-click sign-in as a configured demo account. No password check, so it also
 * works when the account already existed in db.json with a different password.
 */
export const POST = handle(async (req: Request) => {
  const { account } = await parseBody(req, demoLoginSchema);
  const demo = demoAccounts().find((a) => a.key === account);
  if (!demo) throw new NotFoundError("Demo sign-in is not available");

  const user = await loginDemoAccount(demo.email);
  await setSessionCookie(user.id, user.sessionVersion, false);
  await audit({ action: "auth.login", category: "auth", auth: await authForUser(user.id), details: "Demo sign-in (dev mode)", req });
  return { ok: true };
});
