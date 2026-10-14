import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { nextSlot } from "@/lib/backup/schedule";
import { createBackup, listBackups } from "@/lib/backup/service";
import { getConfig } from "@/lib/config";

export const GET = handle(async () => {
  await authorize("settings.backup");
  const { backup } = await getConfig();
  return {
    backups: await listBackups(),
    nextScheduledAt: backup.schedule.enabled ? new Date(nextSlot(new Date(), backup.schedule)).toISOString() : null,
    lastAutoAt: backup.lastAutoAt,
    lastScheduledAt: backup.lastScheduledAt,
  };
});

const createSchema = z.object({ label: z.string().trim().max(80).optional() });

export const POST = handle(async (req: Request) => {
  await authorize("settings.backup");
  const { label } = await parseBody(req, createSchema);
  return createBackup("manual", label || undefined);
});
