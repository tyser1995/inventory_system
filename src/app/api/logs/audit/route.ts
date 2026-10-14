import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { queryAudit } from "@/lib/logs/audit";
import { parseRange } from "@/lib/logs/range";

export const GET = handle(async (req: Request) => {
  await authorize("logs.view");
  const p = new URL(req.url).searchParams;
  const { from, to } = parseRange(p);
  return queryAudit({
    from, to,
    q: p.get("q") ?? undefined,
    userId: p.get("user") || undefined,
    category: p.get("category") || undefined,
    outcome: p.get("outcome") || undefined,
    page: Math.max(1, Number(p.get("page")) || 1),
    pageSize: Math.min(200, Math.max(10, Number(p.get("pageSize")) || 50)),
  });
});
