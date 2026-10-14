import { handle, parseBody, type IdContext } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { categories } from "@/lib/db/repository";
import { categorySchema } from "@/lib/validation";

export const PUT = handle(async (req: Request, { params }: IdContext) => {
  await authorize("categories.manage");
  return categories.update((await params).id, await parseBody(req, categorySchema));
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("categories.manage");
  return categories.remove((await params).id);
});
