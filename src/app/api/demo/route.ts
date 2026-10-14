import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { safetyBackup } from "@/lib/backup/service";
import { demoData } from "@/lib/db/repository";
import { createSeed } from "@/lib/db/seed";
import { SCHEMA_VERSION } from "@/lib/db/store";

/** Demo (sample) data status — any signed-in user, so the UI can show whether it's active. */
export const GET = handle(async () => {
  await authorize();
  return demoData.status();
});

/** Enable / disable demo data (kept, but excluded everywhere while disabled). */
export const PUT = handle(async (req: Request) => {
  await authorize("data.reset");
  const { enabled } = await parseBody(req, z.object({ enabled: z.boolean() }));
  return demoData.setEnabled(enabled);
});

/** remove: delete demo records permanently · add: load the sample dataset next to your data. */
export const POST = handle(async (req: Request) => {
  await authorize("data.reset");
  const { action } = await parseBody(req, z.object({ action: z.enum(["remove", "add"]) }));
  if (action === "remove") {
    await safetyBackup("Before removing demo data");
    return demoData.remove();
  }
  return demoData.add(createSeed(SCHEMA_VERSION));
});
