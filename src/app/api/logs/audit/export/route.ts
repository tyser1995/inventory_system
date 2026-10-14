import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { queryAudit } from "@/lib/logs/audit";
import { parseRange } from "@/lib/logs/range";

const COLS = ["ts", "userName", "role", "action", "category", "outcome", "target", "details", "method", "path", "status", "ip"] as const;

/** Prefix formula-like cells so spreadsheets don't execute them (CSV injection). */
function esc(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV of the filtered activity log (max 50k rows). */
export const GET = handle(async (req: Request) => {
  await authorize("logs.view");
  const p = new URL(req.url).searchParams;
  const { from, to } = parseRange(p);
  const { entries } = await queryAudit({
    from, to, q: p.get("q") ?? undefined, userId: p.get("user") || undefined,
    category: p.get("category") || undefined, outcome: p.get("outcome") || undefined, page: 1, pageSize: 50_000,
  });
  const csv = [COLS.join(","), ...entries.map((e) => COLS.map((c) => esc(e[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
