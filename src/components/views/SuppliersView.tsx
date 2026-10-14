"use client";

import { RequirePermission, useAuth } from "@/components/auth/AuthProvider";
import { useState } from "react";
import { Mail, MapPin, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { SimpleEntityForm, type FieldDef } from "@/components/forms/SimpleEntityForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api, refreshAll, useApi } from "@/lib/client";
import type { Supplier } from "@/lib/types";

type Row = Supplier & { productCount: number };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Company name", placeholder: "Acme Components", required: true },
  { name: "email", label: "Email", type: "email", placeholder: "orders@acme.com", span: 1 },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+1 555 0100", span: 1 },
  { name: "address", label: "Address", placeholder: "City, State" },
];

export function SuppliersView() {
  return (
    <RequirePermission perm={["suppliers.view", "suppliers.manage"]} any>
      <Suppliers />
    </RequirePermission>
  );
}

function Suppliers() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<Row[]>("/api/suppliers");
  const toast = useToast();
  const [form, setForm] = useState<{ open: boolean; item?: Row | null }>({ open: false });
  const [deleting, setDeleting] = useState<Row | null>(null);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase stock from"
        actions={can("suppliers.manage") ? <Button onClick={() => setForm({ open: true })}><Plus className="size-4" /> New supplier</Button> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={Truck} title="No suppliers" description="Add vendors to link them to products." action={can("suppliers.manage") ? <Button onClick={() => setForm({ open: true })}>New supplier</Button> : undefined} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="bg-brand-gradient grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-primary-fg">
                  {s.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  <Badge tone="accent" className="mt-1">{s.productCount} product{s.productCount === 1 ? "" : "s"}</Badge>
                </div>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {s.email && <li className="flex items-center gap-2.5 text-muted"><Mail className="size-4 shrink-0" /><a href={`mailto:${s.email}`} className="truncate hover:text-primary">{s.email}</a></li>}
                {s.phone && <li className="flex items-center gap-2.5 text-muted"><Phone className="size-4 shrink-0" /><a href={`tel:${s.phone}`} className="hover:text-primary">{s.phone}</a></li>}
                {s.address && <li className="flex items-center gap-2.5 text-muted"><MapPin className="size-4 shrink-0" /><span className="truncate">{s.address}</span></li>}
              </ul>
              {can("suppliers.manage") && <div className="mt-4 flex gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" className="flex-1 justify-center" onClick={() => setForm({ open: true, item: s })}><Pencil className="size-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}><Trash2 className="size-3.5" /></Button>
              </div>}
            </Card>
          ))}
        </div>
      )}

      <SimpleEntityForm open={form.open} item={form.item} onClose={() => setForm({ open: false })} endpoint="/api/suppliers" entityLabel="supplier" fields={FIELDS} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete supplier?"
        message={<><b className="text-text">{deleting?.name}</b> will be removed and unlinked from {deleting?.productCount} product(s).</>}
        onConfirm={async () => {
          try {
            await api(`/api/suppliers/${deleting!.id}`, { method: "DELETE" });
            await refreshAll();
            toast("Supplier deleted");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
