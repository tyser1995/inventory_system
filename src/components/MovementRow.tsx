import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtRelative } from "@/lib/format";
import type { StockMovement } from "@/lib/types";

type Movement = StockMovement & { productName: string; sku: string };

const meta = {
  IN: { icon: ArrowDownLeft, label: "Stock in", cls: "bg-primary/10 text-primary" },
  OUT: { icon: ArrowUpRight, label: "Stock out", cls: "bg-accent/15 text-[color-mix(in_oklab,var(--accent)_65%,var(--text))]" },
  ADJUST: { icon: SlidersHorizontal, label: "Adjustment", cls: "bg-surface-2 text-muted" },
};

export function MovementIcon({ type }: { type: StockMovement["type"] }) {
  const { icon: Icon, cls, label } = meta[type];
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", cls)} title={label}>
      <Icon className="size-4" aria-label={label} />
    </span>
  );
}

export function MovementRow({ m, href }: { m: Movement; href?: string }) {
  const content = (
    <>
      <MovementIcon type={m.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.productName}</p>
        <p className="truncate text-xs text-muted">
          {meta[m.type].label} · {m.note ?? m.sku}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold tabular-nums", m.quantity > 0 ? "text-success" : "text-danger")}>
          {m.quantity > 0 ? "+" : ""}
          {m.quantity}
        </p>
        <p className="text-[11px] text-muted">{fmtRelative(m.createdAt)}</p>
      </div>
    </>
  );
  return href ? (
    <li>
      <Link href={href} className="ring-focus -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-2/70">{content}</Link>
    </li>
  ) : (
    <li className="flex items-center gap-3 py-3">{content}</li>
  );
}
