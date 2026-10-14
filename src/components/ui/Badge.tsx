import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { statusLabel } from "@/lib/stock";
import type { StockStatus } from "@/lib/types";

export type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  primary: "text-primary bg-primary/12",
  accent: "text-[color-mix(in_oklab,var(--accent)_65%,var(--text))] bg-accent/15",
  success: "text-success bg-success/12",
  warning: "text-warning bg-warning/14",
  danger: "text-danger bg-danger/12",
  neutral: "text-muted bg-surface-2",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const statusTone: Record<StockStatus, Tone> = { "in-stock": "success", "low-stock": "warning", "out-of-stock": "danger" };
const statusIcon = { "in-stock": CheckCircle2, "low-stock": AlertTriangle, "out-of-stock": XCircle };

/** Status always ships with icon + label, never color alone. */
export function StatusBadge({ status }: { status: StockStatus }) {
  const Icon = statusIcon[status];
  return (
    <Badge tone={statusTone[status]}>
      <Icon className="size-3" aria-hidden />
      {statusLabel[status]}
    </Badge>
  );
}
