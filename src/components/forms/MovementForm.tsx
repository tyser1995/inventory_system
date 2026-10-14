"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import type { MovementType, Product } from "@/lib/types";

const TYPES: { value: MovementType; label: string; hint: string; icon: typeof ArrowDownToLine }[] = [
  { value: "IN", label: "Stock in", hint: "Receive goods", icon: ArrowDownToLine },
  { value: "OUT", label: "Stock out", hint: "Sale / usage", icon: ArrowUpFromLine },
  { value: "ADJUST", label: "Adjust", hint: "Count correction", icon: SlidersHorizontal },
];

interface Props {
  open: boolean;
  productId?: string;
  onClose: () => void;
}

export function MovementForm({ open, productId, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Record stock movement" description="Every change is logged to the ledger">
      {open && <MovementFormBody key={productId ?? "any"} productId={productId} onDone={onClose} />}
    </Modal>
  );
}

function MovementFormBody({ productId, onDone }: { productId?: string; onDone: () => void }) {
  const { data: products } = useApi<Product[]>("/api/products");
  const [form, setForm] = useState({ productId: productId ?? "", type: "IN" as MovementType, quantity: "1", note: "" });
  const { busy, errors, submit } = useFormSubmit();

  const product = products?.find((p) => p.id === form.productId);
  const qty = Number(form.quantity) || 0;
  const delta = form.type === "OUT" ? -Math.abs(qty) : form.type === "IN" ? Math.abs(qty) : qty;
  const projected = product ? product.quantity + delta : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await submit(() => api("/api/movements", { method: "POST", json: form }), "Stock updated");
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Movement type">
        {TYPES.map(({ value, label, hint, icon: Icon }) => {
          const active = form.type === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setForm((f) => ({ ...f, type: value }))}
              className={cn(
                "ring-focus flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                active ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:text-text",
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-semibold">{label}</span>
              <span className="hidden text-[11px] opacity-75 sm:block">{hint}</span>
            </button>
          );
        })}
      </div>

      <Field label="Product" error={errors.productId}>
        <Select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} required>
          <option value="" disabled>Select a product…</option>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.sku} ({p.quantity} {p.unit})
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={form.type === "ADJUST" ? "Change (+/−)" : "Quantity"}
        error={errors.quantity}
        hint={form.type === "ADJUST" ? "Use a negative number to reduce stock" : undefined}
      >
        <Input
          type="number"
          step="1"
          min={form.type === "ADJUST" ? undefined : 1}
          value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          required
        />
      </Field>

      {product && (
        <div className="flex items-center justify-between rounded-xl bg-surface-2/70 px-4 py-3 text-sm">
          <span className="text-muted">On hand → after</span>
          <span className="font-semibold tabular-nums">
            {product.quantity} → <span className={projected! < 0 ? "text-danger" : "text-primary"}>{projected}</span> {product.unit}
          </span>
        </div>
      )}

      <Field label="Note" error={errors.note}>
        <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="PO number, customer, reason…" />
      </Field>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy} disabled={projected !== null && projected < 0}>Record movement</Button>
      </div>
    </form>
  );
}
