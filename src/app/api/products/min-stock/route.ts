import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { products } from "@/lib/db/repository";
import { bulkMinStockSchema } from "@/lib/validation";

/** Sets the minimum stock level for all products, or every product in one category. */
export const POST = handle(async (req: Request) => {
  await authorize("products.edit");
  return products.setMinStock(await parseBody(req, bulkMinStockSchema));
});
