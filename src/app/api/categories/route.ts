import { handle, parseBody } from "@/lib/api";
import { authorize, authorizeAny } from "@/lib/auth/guard";
import { categories } from "@/lib/db/repository";
import { categorySchema } from "@/lib/validation";

/** Product forms need this list too, so product editors can read it. */
export const GET = handle(async () => {
  await authorizeAny("categories.view", "categories.manage", "products.create", "products.edit");
  return categories.list();
});

export const POST = handle(async (req: Request) => {
  await authorize("categories.manage");
  return categories.create(await parseBody(req, categorySchema));
});
