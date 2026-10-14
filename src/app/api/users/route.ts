import { handle, parseBody } from "@/lib/api";
import { createUser, listUsers } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { userCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await authorize("users.manage");
  return listUsers();
});

export const POST = handle(async (req: Request) => {
  const auth = await authorize("users.manage");
  return createUser(auth, await parseBody(req, userCreateSchema));
});
