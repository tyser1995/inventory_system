"use client";

import { RequirePermission, useAuth } from "@/components/auth/AuthProvider";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Search } from "lucide-react";
import { useQuickActions } from "@/components/layout/AppShell";
import { MovementIcon } from "@/components/MovementRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtDate, fmtNumber, fmtRelative } from "@/lib/format";
import type { MovementType, StockMovement } from "@/lib/types";

type Movement = StockMovement & { productName: string; sku: string };

const FILTERS: { value: "ALL" | MovementType; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "IN", label: "Stock in" },
  { value: "OUT", label: "Stock out" },
  { value: "ADJUST", label: "Adjustments" },
];

export function MovementsView() {
  return (
    <RequirePermission perm="movements.view">
      <Movements />
    </RequirePermission>
  );
}

function Movements() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<Movement[]>("/api/movements");
  const { recordMovement } = useQuickActions();
  const [type, setType] = useState<"ALL" | MovementType>("ALL");
  // Preset from ?q= (dashboard activity rows link here). Renders client-side only, after the session check.
  const [query, setQuery] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(location.search).get("q") ?? ""));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (m) => (type === "ALL" || m.type === type) && (!q || `${m.productName} ${m.sku} ${m.note ?? ""}`.toLowerCase().includes(q)),
    );
  }, [data, type, query]);

  const totals = useMemo(
    () => rows.reduce((a, m) => (m.quantity > 0 ? { ...a, in: a.in + m.quantity } : { ...a, out: a.out - m.quantity }), { in: 0, out: 0 }),
    [rows],
  );

  // Group by calendar day for a timeline feel.
  const groups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const m of rows) {
      const key = new Date(m.createdAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Stock movements"
        description="Complete ledger of every stock change"
        actions={can("stock.record") ? <Button onClick={() => recordMovement()}><Plus className="size-4" /> Record movement</Button> : undefined}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted">Entries</p><p className="mt-1 text-xl font-bold tabular-nums">{fmtNumber(rows.length)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Units in</p><p className="mt-1 text-xl font-bold text-success tabular-nums">+{fmtNumber(totals.in)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Units out</p><p className="mt-1 text-xl font-bold text-danger tabular-nums">−{fmtNumber(totals.out)}</p></Card>
      </div>

      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setType(f.value)}
              className={cn(
                "ring-focus cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                type === f.value ? "bg-surface-solid text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU or note" className="pl-9" />
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : groups.length === 0 ? (
        <Card><EmptyState icon={ArrowLeftRight} title="No movements found" description="Record a stock in/out to see it here." /></Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, items]) => (
            <Card key={day} className="overflow-hidden">
              <div className="border-b border-border bg-surface-2/50 px-5 py-2.5 text-xs font-semibold text-muted">
                {fmtDate(items[0].createdAt)}
              </div>
              <ul className="divide-y divide-border">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <MovementIcon type={m.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.productName}</p>
                      <p className="truncate text-xs text-muted">
                        <span className="font-mono">{m.sku}</span>
                        {m.note && <> · {m.note}</>}
                        {m.userName && <> · by {m.userName}</>}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs text-muted sm:block">
                      Balance <b className="text-text tabular-nums">{m.balanceAfter}</b>
                    </div>
                    <div className="w-16 text-right">
                      <p className={cn("text-sm font-semibold tabular-nums", m.quantity > 0 ? "text-success" : "text-danger")}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity}
                      </p>
                      <p className="text-[11px] text-muted">{fmtRelative(m.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
