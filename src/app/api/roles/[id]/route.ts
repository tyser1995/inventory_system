import { handle, parseBody, type IdContext } from "@/lib/api";
import { deleteRole, updateRole } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { roleSchema } from "@/lib/validation";

export const PUT = handle(async (req: Request, { params }: IdContext) => {
  const auth = await authorize("roles.manage");
  return updateRole(auth, (await params).id, await parseBody(req, roleSchema));
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  const auth = await authorize("roles.manage");
  return deleteRole(auth, (await params).id);
});
