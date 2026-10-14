"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";

type Point = { date: string; in: number; out: number };

const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 32 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= v)! * pow;
  return step * 4;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Grouped bars: units received vs. shipped per day. Hover tooltip + table view. */
export function TrendChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);

  // Size the SVG to its container so text and bars never stretch.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.in, d.out))));
  const slot = innerW / data.length;
  const barW = Math.max(3, Math.min(14, slot / 2 - 3));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  // Bar path with 4px rounded top, square baseline.
  const bar = (x: number, v: number) => {
    const top = y(v);
    const h = PAD.top + innerH - top;
    if (h <= 0) return "";
    const r = Math.min(4, barW / 2, h);
    return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${top + h}Z`;
  };

  const totals = data.reduce((a, d) => ({ in: a.in + d.in, out: a.out + d.out }), { in: 0, out: 0 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" /> <span className="text-muted">Stock in</span>
            <span className="font-semibold tabular-nums">{fmtNumber(totals.in)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-2" /> <span className="text-muted">Stock out</span>
            <span className="font-semibold tabular-nums">{fmtNumber(totals.out)}</span>
          </span>
        </div>
        <div className="flex rounded-lg bg-surface-2 p-0.5">
          {([["chart", BarChart3], ["table", Table2]] as const).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-label={`${v} view`}
              aria-pressed={view === v}
              className={cn(
                "ring-focus cursor-pointer rounded-md p-1.5",
                view === v ? "bg-surface-solid text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <div className="max-h-[220px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-solid text-xs text-muted">
              <tr><th className="px-3 py-2 text-left font-medium">Date</th><th className="px-3 py-2 text-right font-medium">In</th><th className="px-3 py-2 text-right font-medium">Out</th></tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="px-3 py-1.5">{dayLabel(d.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.in}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={wrapRef}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Daily stock in and out, last 14 days">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]">{fmtNumber(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              return (
                <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity">
                  <path d={bar(cx - barW - 1, d.in)} fill="var(--chart-1)" />
                  <path d={bar(cx + 1, d.out)} fill="var(--chart-2)" />
                  {(i % Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56))) === 0) && (
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">{dayLabel(d.date)}</text>
                  )}
                  {/* Oversized hit target */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onTouchStart={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface-solid px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}
            >
              <p className="mb-1 font-semibold">{dayLabel(data[hover].date)}</p>
              <p className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-1" /> In <b className="ml-auto pl-3 tabular-nums">{data[hover].in}</b></p>
              <p className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-2" /> Out <b className="ml-auto pl-3 tabular-nums">{data[hover].out}</b></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
