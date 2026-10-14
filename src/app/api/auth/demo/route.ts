import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { login } from "@/lib/auth/accounts";
import { authForUser } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { DEMO_ACCOUNT_KEYS, demoAccounts } from "@/lib/db/demo-users";
import { NotFoundError } from "@/lib/errors";
import { audit, clientIp } from "@/lib/logs/audit";

/** Public, dev mode only: the demo accounts the login page can offer (never their passwords). */
export const GET = handle(async () => demoAccounts().map(({ key, label, name, email }) => ({ key, label, name, email })));

const demoLoginSchema = z.object({ account: z.enum(DEMO_ACCOUNT_KEYS) });

/** Dev mode only: one-click sign-in as a demo account, using the password from the environment. */
export const POST = handle(async (req: Request) => {
  const { account } = await parseBody(req, demoLoginSchema);
  const demo = demoAccounts().find((a) => a.key === account);
  if (!demo) throw new NotFoundError("Demo sign-in is not available");

  // Same path as a normal login: deactivated accounts, rate limiting and last-login still apply.
  const user = await login(demo.email, demo.password, clientIp(req));
  await setSessionCookie(user.id, user.sessionVersion, false);
  await audit({ action: "auth.login", category: "auth", auth: await authForUser(user.id), details: "Demo sign-in (dev mode)", req });
  return { ok: true };
});
