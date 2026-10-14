import { handle, parseBody } from "@/lib/api";
import { authorize, authorizeAny } from "@/lib/auth/guard";
import { suppliers } from "@/lib/db/repository";
import { supplierSchema } from "@/lib/validation";

/** Product forms need this list too, so product editors can read it. */
export const GET = handle(async () => {
  await authorizeAny("suppliers.view", "suppliers.manage", "products.create", "products.edit");
  return suppliers.list();
});

export const POST = handle(async (req: Request) => {
  await authorize("suppliers.manage");
  return suppliers.create(await parseBody(req, supplierSchema));
});
