import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { getConfig, updateConfig } from "@/lib/config";
import { logStorageSize, pruneLogs } from "@/lib/logs/files";

export const GET = handle(async () => {
  await authorize("logs.view");
  return { ...(await getConfig()).logs, storageBytes: await logStorageSize() };
});

const schema = z.object({
  retentionDays: z.coerce.number().int().min(1, "At least 1 day").max(3650, "At most 10 years"),
  trackPageViews: z.boolean(),
});

export const PUT = handle(async (req: Request) => {
  await authorize("logs.manage");
  const input = await parseBody(req, schema);
  const next = await updateConfig((c) => void (c.logs = input));
  await pruneLogs(input.retentionDays);
  return { ...next.logs, storageBytes: await logStorageSize() };
});
