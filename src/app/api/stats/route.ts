import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { stats } from "@/lib/db/repository";

export const GET = handle(async () => {
  await authorize("dashboard.view");
  return stats();
});
