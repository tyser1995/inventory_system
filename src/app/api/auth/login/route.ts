import { handle, parseBody } from "@/lib/api";
import { login } from "@/lib/auth/accounts";
import { authForUser } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { RateLimitError } from "@/lib/errors";
import { audit, clientIp } from "@/lib/logs/audit";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const { email, password, remember } = await parseBody(req, loginSchema);
  let user;
  try {
    user = await login(email, password, clientIp(req));
  } catch (err) {
    await audit({
      action: err instanceof RateLimitError ? "auth.login_locked" : "auth.login_failed",
      category: "auth", outcome: err instanceof RateLimitError ? "denied" : "failed",
      actorName: email.trim().toLowerCase(), details: (err as Error).message, req,
    });
    throw err;
  }
  await setSessionCookie(user.id, user.sessionVersion, remember);
  await audit({ action: "auth.login", category: "auth", auth: await authForUser(user.id), details: remember ? "Remember me (30 days)" : undefined, req });
  return { ok: true };
});
