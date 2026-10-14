import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { cancelPendingAuto } from "@/lib/backup/scheduler";
import { getConfig, updateConfig } from "@/lib/config";
import { backupPolicySchema } from "@/lib/validation";

export const GET = handle(async () => {
  await authorize("settings.backup");
  return (await getConfig()).backup;
});

export const PUT = handle(async (req: Request) => {
  await authorize("settings.backup");
  const input = await parseBody(req, backupPolicySchema);
  const before = (await getConfig()).backup;
  const next = await updateConfig((c) => {
    const scheduleChanged =
      !before.schedule.enabled && input.schedule.enabled ||
      before.schedule.frequency !== input.schedule.frequency ||
      before.schedule.time !== input.schedule.time ||
      before.schedule.weekday !== input.schedule.weekday;
    Object.assign(c.backup, input);
    // Count from now so enabling/changing a schedule doesn't fire immediately for a past slot.
    if (scheduleChanged) c.backup.lastScheduledAt = new Date().toISOString();
  });
  if (!input.auto.enabled) cancelPendingAuto();
  return next.backup;
});
