import { handle, parsePatch, type IdContext } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { products } from "@/lib/db/repository";
import { productUpdateSchema } from "@/lib/validation";

export const GET = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("products.view");
  return products.get((await params).id);
});

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await authorize("products.edit");
  return products.update((await params).id, await parsePatch(req, productUpdateSchema));
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("products.delete");
  return products.remove((await params).id);
});
