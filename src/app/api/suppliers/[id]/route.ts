import { handle, parseBody, type IdContext } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { suppliers } from "@/lib/db/repository";
import { supplierSchema } from "@/lib/validation";

export const PUT = handle(async (req: Request, { params }: IdContext) => {
  await authorize("suppliers.manage");
  return suppliers.update((await params).id, await parseBody(req, supplierSchema));
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("suppliers.manage");
  return suppliers.remove((await params).id);
});
