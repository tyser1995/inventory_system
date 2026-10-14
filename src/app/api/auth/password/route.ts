import { handle, parseBody } from "@/lib/api";
import { changeOwnPassword } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation";

/** Changes the caller's password, signs out their other sessions and re-issues this one. */
export const POST = handle(async (req: Request) => {
  const auth = await authorize();
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const user = await changeOwnPassword(auth, currentPassword, newPassword);
  await setSessionCookie(user.id, user.sessionVersion, false);
  return { ok: true };
});
