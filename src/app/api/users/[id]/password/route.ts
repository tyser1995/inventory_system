import { handle, parseBody, type IdContext } from "@/lib/api";
import { resetUserPassword } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { passwordResetSchema } from "@/lib/validation";

/** Sets a new password for another user and signs them out everywhere. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const auth = await authorize("users.manage");
  const { password } = await parseBody(req, passwordResetSchema);
  return resetUserPassword(auth, (await params).id, password);
});
