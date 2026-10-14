import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { alerts } from "@/lib/db/repository";

/** Stock alerts for the bell, with the caller's read state. */
export const GET = handle(async () => {
  const auth = await authorize("products.view");
  return alerts.list(auth.user.id);
});
