"use client";

import { useState } from "react";
import { BellRing, Layers } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, useApi } from "@/lib/client";
import { stockStatus } from "@/lib/stock";
import type { AlertSettings as Settings, Category, Product } from "@/lib/types";

export function AlertSettings() {
  const { can } = useAuth();
  const { data } = useApi<Settings>("/api/settings/alerts");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {can("settings.alerts") && (
        <Card className="h-fit">
          <CardHeader title="Stock alerts" subtitle="Notify the team when products reach their minimum stock" />
          {data ? <AlertSettingsForm key={JSON.stringify(data)} initial={data} /> : <div className="p-5"><Skeleton className="h-48" /></div>}
        </Card>
      )}
      {can("products.edit") && <BulkMinStock />}
    </div>
  );
}

function AlertSettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const { busy, errors, submit } = useFormSubmit();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit(() => api("/api/settings/alerts", { method: "PUT", json: form }), "Alert settings saved");
      }}
    >
      <div className="space-y-4 rounded-xl border border-border p-4">
        <Switch
          checked={form.enabled}
          onChange={(enabled) => setForm((f) => ({ ...f, enabled }))}
          label="Low & out-of-stock alerts"
          description="Raise an alert when a product drops to or below its minimum stock, or runs out"
        />
        <Switch
          checked={form.notifyRestock}
          onChange={(notifyRestock) => setForm((f) => ({ ...f, notifyRestock }))}
          label="Restock alerts"
          description="Also notify when a product goes back above its minimum"
          disabled={!form.enabled}
        />
      </div>
      <Field label="Default minimum stock" error={errors.defaultMinStock} hint="Pre-filled when creating a new product">
        <Input
          type="number"
          min={0}
          step={1}
          value={form.defaultMinStock}
          onChange={(e) => setForm((f) => ({ ...f, defaultMinStock: Number(e.target.value) }))}
          className="block max-w-40"
        />
      </Field>
      <p className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-3 text-xs text-muted">
        <BellRing className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Alerts appear in the bell at the top of the screen for everyone who can view products. Each person can also turn on desktop notifications from the bell.
      </p>
      <Button type="submit" loading={busy} disabled={!dirty}>Save alert settings</Button>
    </form>
  );
}

function BulkMinStock() {
  const { data: categories } = useApi<Category[]>("/api/categories");
  const { data: products } = useApi<Product[]>("/api/products");
  const [scope, setScope] = useState<"all" | "category">("all");
  const [categoryId, setCategoryId] = useState<string>("");
  const [minStock, setMinStock] = useState(5);
  const [confirm, setConfirm] = useState(false);
  const { errors, submit } = useFormSubmit();

  const targets = (products ?? []).filter((p) => scope === "all" || (p.categoryId ?? "") === categoryId);
  // Preview how many products would be flagged with the new minimum.
  const wouldAlert = targets.filter((p) => stockStatus({ quantity: p.quantity, reorderLevel: minStock }) !== "in-stock").length;
  const scopeLabel = scope === "all" ? "all products" : `every product in “${categories?.find((c) => c.id === categoryId)?.name ?? "Uncategorized"}”`;

  return (
    <Card className="h-fit">
      <CardHeader title="Set minimum stock in bulk" subtitle="Apply one minimum level to many products at once" />
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Apply to">
            <Select value={scope} onChange={(e) => setScope(e.target.value as "all" | "category")}>
              <option value="all">All products</option>
              <option value="category">One category</option>
            </Select>
          </Field>
          {scope === "category" && (
            <Field label="Category" error={errors.categoryId}>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Uncategorized</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Minimum stock" error={errors.minStock} hint="Alert when stock is at or below this number">
          <Input type="number" min={0} step={1} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} className="block max-w-40" />
        </Field>
        <div className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-3 text-sm">
          <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <b>{targets.length}</b> product{targets.length === 1 ? "" : "s"} will be updated
            {targets.length > 0 && <> · <b>{wouldAlert}</b> would be at or below the new minimum</>}.
          </span>
        </div>
        <Button onClick={() => setConfirm(true)} disabled={!targets.length || minStock < 0}>Apply minimum</Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Update minimum stock?"
        message={<>Set the minimum stock of {scopeLabel} ({targets.length}) to <b className="text-text">{minStock}</b>. Products that cross the new level will raise alerts.</>}
        confirmLabel="Apply"
        onConfirm={async () => {
          await submit(
            () => api("/api/products/min-stock", { method: "POST", json: { scope, categoryId: scope === "category" ? categoryId || null : undefined, minStock } }),
            `Minimum stock updated for ${targets.length} product${targets.length === 1 ? "" : "s"}`,
          );
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
