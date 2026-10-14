import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { NotFoundError } from "@/lib/errors";
import { logRetentionDays } from "@/lib/logs/audit";
import { getErrorGroup } from "@/lib/logs/errors";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ fp: string }> }) => {
  await authorize("logs.view");
  const group = await getErrorGroup((await params).fp, await logRetentionDays());
  if (!group) throw new NotFoundError("Error not found");
  return group;
});
