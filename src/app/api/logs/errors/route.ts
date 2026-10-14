import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { logRetentionDays } from "@/lib/logs/audit";
import { listErrorGroups, setErrorStatus } from "@/lib/logs/errors";

export const GET = handle(async (req: Request) => {
  await authorize("logs.view");
  const days = Math.min(Number(new URL(req.url).searchParams.get("days")) || 30, await logRetentionDays());
  const groups = await listErrorGroups(days);
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  return {
    groups,
    stats: {
      open: groups.filter((g) => g.status === "open").length,
      resolved: groups.filter((g) => g.status === "resolved").length,
      ignored: groups.filter((g) => g.status === "ignored").length,
      last24h: groups.filter((g) => g.lastSeen >= dayAgo).length,
      occurrences: groups.reduce((s, g) => s + g.count, 0),
    },
  };
});

const updateSchema = z.object({
  fingerprints: z.array(z.string().regex(/^[0-9a-f]{16}$/)).min(1).max(500),
  status: z.enum(["open", "resolved", "ignored"]),
  note: z.string().trim().max(500).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const auth = await authorize("logs.manage");
  const { fingerprints, status, note } = await parseBody(req, updateSchema);
  await setErrorStatus(fingerprints, status, auth.user.name, note);
  return { ok: true, updated: fingerprints.length, name: `${fingerprints.length} error group(s) → ${status}` };
});
