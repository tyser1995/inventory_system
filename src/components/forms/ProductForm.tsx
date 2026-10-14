"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, useApi } from "@/lib/client";
import { fmtCurrency } from "@/lib/format";
import type { AlertSettings, Category, Product, Supplier } from "@/lib/types";

interface Props {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
}

const empty = {
  sku: "", name: "", description: "", categoryId: "", supplierId: "", unit: "pcs",
  costPrice: "", sellPrice: "", quantity: "0", reorderLevel: "5", location: "",
};

type FormState = typeof empty;

function toForm(p?: Product | null): FormState {
  if (!p) return empty;
  return {
    sku: p.sku, name: p.name, description: p.description ?? "", categoryId: p.categoryId ?? "",
    supplierId: p.supplierId ?? "", unit: p.unit, costPrice: String(p.costPrice), sellPrice: String(p.sellPrice),
    quantity: String(p.quantity), reorderLevel: String(p.reorderLevel), location: p.location ?? "",
  };
}

export function ProductForm({ open, product, onClose }: Props) {
  // Remount the inner form whenever the target changes so state resets cleanly.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Edit product" : "New product"}
      description={product ? `SKU ${product.sku}` : "Add an item to your catalog"}
      size="lg"
    >
      {open && <ProductFormBody key={product?.id ?? "new"} product={product} onDone={onClose} />}
    </Modal>
  );
}

function ProductFormBody({ product, onDone }: { product?: Product | null; onDone: () => void }) {
  const { data: alertSettings } = useApi<AlertSettings>("/api/settings/alerts");
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [touchedMin, setTouchedMin] = useState(false);
  // New products start with the workspace default minimum (until the user edits the field).
  const minValue = !product && !touchedMin && alertSettings ? String(alertSettings.defaultMinStock) : form.reorderLevel;
  const { busy, errors, submit } = useFormSubmit();
  const { data: categories } = useApi<Category[]>("/api/categories");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const cost = Number(form.costPrice) || 0;
  const sell = Number(form.sellPrice) || 0;
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { quantity, ...rest } = { ...form, reorderLevel: minValue };
    const ok = product
      ? await submit(() => api(`/api/products/${product.id}`, { method: "PATCH", json: rest }), "Product updated")
      : await submit(() => api("/api/products", { method: "POST", json: { ...rest, quantity } }), "Product created");
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Ryzen 7 7800X3D" autoFocus required />
        </Field>
        <Field label="SKU" error={errors.sku}>
          <Input value={form.sku} onChange={set("sku")} placeholder="CPU-R7-7800X3D" className="font-mono uppercase" required />
        </Field>
        <Field label="Unit" error={errors.unit}>
          <Select value={form.unit} onChange={set("unit")}>
            {["pcs", "box", "kit", "pack", "kg", "m"].map((u) => <option key={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Category" error={errors.categoryId}>
          <Select value={form.categoryId} onChange={set("categoryId")}>
            <option value="">Uncategorized</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Supplier" error={errors.supplierId}>
          <Select value={form.supplierId} onChange={set("supplierId")}>
            <option value="">No supplier</option>
            {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 rounded-xl bg-surface-2/70 p-4 sm:grid-cols-3">
        <Field label="Cost price" error={errors.costPrice}>
          <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={set("costPrice")} placeholder="0.00" required />
        </Field>
        <Field label="Sell price" error={errors.sellPrice}>
          <Input type="number" min="0" step="0.01" value={form.sellPrice} onChange={set("sellPrice")} placeholder="0.00" required />
        </Field>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Margin</span>
          <div className="flex h-10 items-center gap-2 text-sm">
            <span className={margin < 0 ? "font-bold text-danger" : "font-bold text-success"}>{margin.toFixed(1)}%</span>
            <span className="text-muted">· {fmtCurrency(sell - cost)} / unit</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={product ? "Quantity on hand" : "Opening stock"}
          error={errors.quantity}
          hint={product ? "Change via stock movements" : undefined}
        >
          <Input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} disabled={!!product} />
        </Field>
        <Field label="Minimum stock" error={errors.reorderLevel} hint="You'll be alerted at or below this">
          <Input
            type="number"
            min="0"
            step="1"
            value={minValue}
            onChange={(e) => { setTouchedMin(true); set("reorderLevel")(e); }}
          />
        </Field>
        <Field label="Bin location" error={errors.location}>
          <Input value={form.location} onChange={set("location")} placeholder="A1-01" />
        </Field>
      </div>

      <Field label="Description" error={errors.description}>
        <Textarea value={form.description} onChange={set("description")} placeholder="Optional notes" />
      </Field>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{product ? "Save changes" : "Create product"}</Button>
      </div>
    </form>
  );
}
