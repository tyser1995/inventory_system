"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api } from "@/lib/client";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  required?: boolean;
  span?: 1 | 2;
}

interface Props<T extends { id: string }> {
  open: boolean;
  onClose: () => void;
  /** Collection endpoint, e.g. /api/categories */
  endpoint: string;
  entityLabel: string;
  fields: FieldDef[];
  item?: T | null;
}

/** Generic create/edit modal for flat entities (categories, suppliers). */
export function SimpleEntityForm<T extends { id: string }>({ open, onClose, endpoint, entityLabel, fields, item }: Props<T>) {
  return (
    <Modal open={open} onClose={onClose} title={item ? `Edit ${entityLabel}` : `New ${entityLabel}`}>
      {open && <Body key={item?.id ?? "new"} {...{ endpoint, entityLabel, fields, item, onDone: onClose }} />}
    </Modal>
  );
}

function Body<T extends { id: string }>({
  endpoint, entityLabel, fields, item, onDone,
}: Omit<Props<T>, "open" | "onClose"> & { onDone: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, String((item as Record<string, unknown> | null)?.[f.name] ?? "")])),
  );
  const { busy, errors, submit } = useFormSubmit();
  const label = entityLabel[0].toUpperCase() + entityLabel.slice(1);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = item
      ? await submit(() => api(`${endpoint}/${item.id}`, { method: "PUT", json: form }), `${label} updated`)
      : await submit(() => api(endpoint, { method: "POST", json: form }), `${label} created`);
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f, i) => {
          const props = {
            value: form[f.name],
            placeholder: f.placeholder,
            required: f.required,
            autoFocus: i === 0,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setForm((s) => ({ ...s, [f.name]: e.target.value })),
          };
          return (
            <Field key={f.name} label={f.label} error={errors[f.name]} className={f.span === 1 ? "" : "sm:col-span-2"}>
              {f.type === "textarea" ? <Textarea {...props} /> : <Input type={f.type ?? "text"} {...props} />}
            </Field>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{item ? "Save changes" : `Create ${entityLabel}`}</Button>
      </div>
    </form>
  );
}
