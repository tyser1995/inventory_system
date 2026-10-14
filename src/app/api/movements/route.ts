import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { movements } from "@/lib/db/repository";
import { movementSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await authorize("movements.view");
  return movements.list();
});

export const POST = handle(async (req: Request) => {
  const auth = await authorize("stock.record");
  return movements.record(await parseBody(req, movementSchema), auth.user.name);
});
