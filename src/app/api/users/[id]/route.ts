import { handle, parsePatch, type IdContext } from "@/lib/api";
import { deleteUser, updateUser } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { userUpdateSchema } from "@/lib/validation";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const auth = await authorize("users.manage");
  return updateUser(auth, (await params).id, await parsePatch(req, userUpdateSchema));
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  const auth = await authorize("users.manage");
  return deleteUser(auth, (await params).id);
});
