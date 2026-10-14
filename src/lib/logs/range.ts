import { BadRequestError } from "../errors";

/** Parses ?days=N (relative to now) or ?from=&to= (ISO dates/datetimes); defaults to the last 7 days. */
export function parseRange(p: URLSearchParams) {
  const to = p.get("to") ? new Date(p.get("to")!) : new Date();
  const days = Number(p.get("days"));
  const from = p.get("from") ? new Date(p.get("from")!) : new Date(to.getTime() - (days > 0 ? Math.min(days, 3650) : 7) * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestError("Invalid date range");
  // A date-only "to" means the end of that day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.get("to") ?? "")) to.setHours(23, 59, 59, 999);
  return { from, to };
}
