"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, FlaskConical, PackagePlus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { api, refreshAll, useApi } from "@/lib/client";

export interface DemoStatus {
  enabled: boolean;
  counts: { products: number; categories: number; suppliers: number; movements: number };
  realProducts: number;
}

type Pending = "remove" | "add" | "clear" | null;

export function DataSettings() {
  const { data } = useApi<DemoStatus>("/api/demo");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  if (!data) return <Skeleton className="h-72" />;
  const hasDemo = data.counts.products + data.counts.categories + data.counts.suppliers > 0;

  async function run(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      await refreshAll();
      router.refresh();
      toast(message);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    await run(() => api("/api/demo", { method: "PUT", json: { enabled } }), enabled ? "Demo data enabled" : "Demo data disabled");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Demo data"
          subtitle="Sample products, categories, suppliers and stock history that ship with the app"
          action={hasDemo ? <Badge tone={data.enabled ? "success" : "neutral"}>{data.enabled ? "Enabled" : "Disabled"}</Badge> : <Badge>Not loaded</Badge>}
        />
        <div className="space-y-4 p-5">
          {hasDemo ? (
            <>
              <div className="rounded-xl border border-border p-4">
                <Switch
                  checked={data.enabled}
                  onChange={toggle}
                  disabled={busy}
                  label="Enable demo data"
                  description="When disabled, sample records are excluded from every list, total, chart and alert — but kept, so you can enable them again any time."
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(data.counts).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface-2/70 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{v}</p>
                    <p className="text-[11px] text-muted capitalize">Demo {k}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">
                Your own records ({data.realProducts} product{data.realProducts === 1 ? "" : "s"}) are never affected by these controls.
                Stock movements recorded on a demo product count as demo data.
              </p>
              <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setPending("remove")}>
                <Trash2 className="size-4" /> Remove demo data permanently
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-2/70 p-4 sm:flex-row sm:items-center">
              <FlaskConical className="size-8 shrink-0 text-primary" />
              <p className="flex-1 text-sm text-muted">No demo data is loaded. Add the sample dataset to explore the app — it sits alongside your data and can be disabled or removed later.</p>
              <Button variant="outline" onClick={() => setPending("add")}><PackagePlus className="size-4" /> Add demo data</Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="border-danger/25">
        <CardHeader title="Clear all data" subtitle="Deletes every product, category, supplier, movement and alert. Users, roles and settings are kept." />
        <div className="p-5">
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setPending("clear")}><Eraser className="size-4" /> Clear all data</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={pending === "remove" ? "Remove demo data permanently?" : pending === "add" ? "Add demo data?" : "Clear all data?"}
        message={
          pending === "remove"
            ? `${data.counts.products} demo products, ${data.counts.categories} categories, ${data.counts.suppliers} suppliers and their stock history will be deleted. Your own records stay. A safety backup is taken first (if enabled).`
            : pending === "add"
              ? "The sample dataset is added next to your data. Items whose SKU or category name already exists are skipped."
              : "Every product, category, supplier, movement and alert will be deleted — including your own records. A safety backup is taken first (if enabled)."
        }
        confirmLabel={pending === "remove" ? "Remove demo data" : pending === "add" ? "Add demo data" : "Clear everything"}
        onConfirm={() =>
          pending === "remove"
            ? run(() => api("/api/demo", { method: "POST", json: { action: "remove" } }), "Demo data removed")
            : pending === "add"
              ? run(() => api("/api/demo", { method: "POST", json: { action: "add" } }), "Demo data added")
              : run(() => api("/api/reset", { method: "POST" }), "All data cleared")
        }
        onClose={() => setPending(null)}
      />
    </div>
  );
}
