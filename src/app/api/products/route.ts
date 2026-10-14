import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { products } from "@/lib/db/repository";
import { productSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await authorize("products.view");
  return products.list();
});

export const POST = handle(async (req: Request) => {
  const auth = await authorize("products.create");
  return products.create(await parseBody(req, productSchema), auth.user.name);
});
