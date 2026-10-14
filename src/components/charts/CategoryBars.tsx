import Link from "next/link";
import { fmtCurrency, fmtCurrencyCompact, fmtNumber } from "@/lib/format";

type Row = { id: string | null; name: string; value: number; units: number };

/** Single-series horizontal bars (inventory value by category), direct-labeled. */
export function CategoryBars({ data, hrefFor }: { data: Row[]; hrefFor?: (id: string | null) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <ul className="space-y-3.5">
      {data.map((d) => (
        <li key={d.id ?? "none"} className="group" title={`${d.name}: ${fmtCurrency(d.value)} · ${fmtNumber(d.units)} units`}>
          {hrefFor ? (
            <Link href={hrefFor(d.id)} className="ring-focus -mx-2 block rounded-lg px-2 py-1 hover:bg-surface-2/70">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{d.name}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{fmtCurrencyCompact(d.value)}</span>
              <span className="ml-1.5 text-xs text-muted">{((d.value / total) * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-chart-1 transition-all duration-500 group-hover:brightness-110"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
            </Link>
          ) : (
            <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{d.name}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{fmtCurrencyCompact(d.value)}</span>
              <span className="ml-1.5 text-xs text-muted">{((d.value / total) * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-chart-1 transition-all duration-500 group-hover:brightness-110"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
