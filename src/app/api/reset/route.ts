import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { safetyBackup } from "@/lib/backup/service";
import { resetDatabase } from "@/lib/db/store";

/** Clears all inventory data (users, roles and settings are kept). A safety backup is taken first. */
export const POST = handle(async () => {
  await authorize("data.reset");
  await safetyBackup("Before clearing all data");
  await resetDatabase(true);
  return { ok: true };
});
