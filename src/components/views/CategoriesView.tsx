"use client";

import { RequirePermission, useAuth } from "@/components/auth/AuthProvider";
import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { SimpleEntityForm, type FieldDef } from "@/components/forms/SimpleEntityForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api, refreshAll, useApi } from "@/lib/client";
import { fmtCurrencyCompact } from "@/lib/format";
import type { Category, DashboardStats } from "@/lib/types";

type Row = Category & { productCount: number };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Name", placeholder: "e.g. Graphics Cards", required: true },
  { name: "description", label: "Description", type: "textarea", placeholder: "Optional" },
];

export function CategoriesView() {
  return (
    <RequirePermission perm={["categories.view", "categories.manage"]} any>
      <Categories />
    </RequirePermission>
  );
}

function Categories() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<Row[]>("/api/categories");
  const { data: stats } = useApi<DashboardStats>(can("dashboard.view") ? "/api/stats" : null);
  const toast = useToast();
  const [form, setForm] = useState<{ open: boolean; item?: Row | null }>({ open: false });
  const [deleting, setDeleting] = useState<Row | null>(null);

  const valueOf = (id: string) => stats?.categoryBreakdown.find((c) => c.id === id);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products for reporting and filtering"
        actions={can("categories.manage") ? <Button onClick={() => setForm({ open: true })}><Plus className="size-4" /> New category</Button> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={Tags} title="No categories" description="Create one to organize products." action={can("categories.manage") ? <Button onClick={() => setForm({ open: true })}>New category</Button> : undefined} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c, i) => {
            const v = valueOf(c.id);
            return (
              <Card key={c.id} className="group relative overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
                <div
                  className="absolute -top-10 -right-10 size-32 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-90"
                  style={{ background: `color-mix(in oklab, var(${i % 2 ? "--accent" : "--primary"}) 30%, transparent)` }}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Tags className="size-5" /></span>
                  {can("categories.manage") && <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setForm({ open: true, item: c })} aria-label={`Edit ${c.name}`}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8 hover:text-danger" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}><Trash2 className="size-4" /></Button>
                  </div>}
                </div>
                <h3 className="relative mt-4 font-semibold">{c.name}</h3>
                <p className="relative mt-0.5 line-clamp-1 text-sm text-muted">{c.description || "No description"}</p>
                <div className="relative mt-4 flex gap-6 border-t border-border pt-3 text-sm">
                  <div><p className="text-xs text-muted">Products</p><p className="font-semibold tabular-nums">{c.productCount}</p></div>
                  <div><p className="text-xs text-muted">Units</p><p className="font-semibold tabular-nums">{v?.units ?? 0}</p></div>
                  <div><p className="text-xs text-muted">Value</p><p className="font-semibold tabular-nums">{fmtCurrencyCompact(v?.value ?? 0)}</p></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SimpleEntityForm open={form.open} item={form.item} onClose={() => setForm({ open: false })} endpoint="/api/categories" entityLabel="category" fields={FIELDS} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete category?"
        message={<><b className="text-text">{deleting?.name}</b> will be removed. Its {deleting?.productCount} product(s) become uncategorized.</>}
        onConfirm={async () => {
          try {
            await api(`/api/categories/${deleting!.id}`, { method: "DELETE" });
            await refreshAll();
            toast("Category deleted");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
