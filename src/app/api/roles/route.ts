import { handle, parseBody } from "@/lib/api";
import { createRole, listRoles } from "@/lib/auth/accounts";
import { authorize, authorizeAny } from "@/lib/auth/guard";
import { roleSchema } from "@/lib/validation";

/** Readable by user managers too, since they assign roles. */
export const GET = handle(async () => {
  await authorizeAny("users.manage", "roles.manage");
  return listRoles();
});

export const POST = handle(async (req: Request) => {
  const auth = await authorize("roles.manage");
  return createRole(auth, await parseBody(req, roleSchema));
});
