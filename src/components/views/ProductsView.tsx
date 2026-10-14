"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Download, MapPin, MoreHorizontal, Package, Pencil, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { RequirePermission, useAuth } from "@/components/auth/AuthProvider";
import { ProductForm } from "@/components/forms/ProductForm";
import { trackExport } from "@/components/logs/ActivityTracker";
import { useQuickActions } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { api, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { stockStatus } from "@/lib/stock";
import type { Category, Product, Supplier } from "@/lib/types";

type SortKey = "updated" | "name" | "quantity" | "value";

export function ProductsView() {
  return (
    <RequirePermission perm="products.view">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Products />
      </Suspense>
    </RequirePermission>
  );
}

function Products() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { recordMovement } = useQuickActions();
  const { can } = useAuth();
  const { data: products, isLoading } = useApi<Product[]>("/api/products");
  const { data: categories } = useApi<Category[]>("/api/categories");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");

  const [query, setQuery] = useState(params.get("q") ?? "");
  // Filters can be preset from the URL (e.g. dashboard cards link to ?status=low-stock).
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [sort, setSort] = useState<SortKey>(() => {
    const s = params.get("sort");
    return s === "name" || s === "quantity" || s === "value" ? s : "updated";
  });
  const [editing, setEditing] = useState<{ open: boolean; product?: Product | null }>({ open: false });
  const [deleting, setDeleting] = useState<Product | null>(null);

  const catName = useMemo(() => new Map(categories?.map((c) => [c.id, c.name])), [categories]);
  const supName = useMemo(() => new Map(suppliers?.map((s) => [s.id, s.name])), [suppliers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (products ?? []).filter((p) => {
      if (q && !`${p.name} ${p.sku} ${p.location ?? ""}`.toLowerCase().includes(q)) return false;
      if (category !== "all" && (p.categoryId ?? "none") !== category) return false;
      const st = stockStatus(p);
      if (status === "attention") return st !== "in-stock";
      if (status !== "all" && st !== status) return false;
      return true;
    });
    const sorters: Record<SortKey, (a: Product, b: Product) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      name: (a, b) => a.name.localeCompare(b.name),
      quantity: (a, b) => a.quantity - b.quantity,
      value: (a, b) => b.quantity * b.costPrice - a.quantity * a.costPrice,
    };
    return list.sort(sorters[sort]);
  }, [products, query, category, status, sort]);

  function exportCsv() {
    const header = ["SKU", "Name", "Category", "Supplier", "Unit", "Cost", "Price", "Quantity", "Minimum stock", "Location"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((p) =>
      [p.sku, p.name, catName.get(p.categoryId ?? ""), supName.get(p.supplierId ?? ""), p.unit, p.costPrice, p.sellPrice, p.quantity, p.reorderLevel, p.location]
        .map(esc).join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `inventory-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
    trackExport("products.csv", rows.length);
  }

  async function remove(p: Product) {
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      await refreshAll();
      toast(`Deleted ${p.name}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const filtersActive = query || category !== "all" || status !== "all";

  return (
    <>
      <PageHeader
        title="Products"
        description={products ? `${fmtNumber(products.length)} items in catalog` : "Loading catalog…"}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> Export</Button>
            {can("products.create") && <Button onClick={() => setEditing({ open: true, product: null })}><Plus className="size-4" /> Add product</Button>}
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_170px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (params.get("q")) router.replace("/products");
              }}
              placeholder="Search name, SKU or location"
              className="pl-9"
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Uncategorized</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Stock status">
            <option value="all">All statuses</option>
            <option value="attention">Needs attention</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </Select>
          <div className="relative">
            <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="pl-9" aria-label="Sort">
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
              <option value="quantity">Lowest stock</option>
              <option value="value">Highest value</option>
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={filtersActive ? "No matching products" : "No products yet"}
            description={filtersActive ? "Try a different search or clear filters." : "Add your first product to start tracking stock."}
            action={
              filtersActive ? (
                <Button variant="outline" onClick={() => { setQuery(""); setCategory("all"); setStatus("all"); router.replace("/products"); }}>Clear filters</Button>
              ) : can("products.create") ? (
                <Button onClick={() => setEditing({ open: true, product: null })}><Plus className="size-4" /> Add product</Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted uppercase">
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-3 py-3.5">Category</th>
                    <th className="px-3 py-3.5 text-right">Price</th>
                    <th className="px-3 py-3.5">Stock</th>
                    <th className="px-3 py-3.5">Status</th>
                    <th className="px-3 py-3.5 text-right">Value</th>
                    <th className="w-px px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-primary/[0.03]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <ProductAvatar name={p.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="font-mono text-xs text-muted">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {p.categoryId ? <Badge tone="primary">{catName.get(p.categoryId)}</Badge> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <p className="font-medium">{fmtCurrency(p.sellPrice)}</p>
                        <p className="text-xs text-muted">cost {fmtCurrency(p.costPrice)}</p>
                      </td>
                      <td className="px-3 py-3"><StockMeter p={p} /></td>
                      <td className="px-3 py-3"><StatusBadge status={stockStatus(p)} /></td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{fmtCurrency(p.quantity * p.costPrice)}</td>
                      <td className="px-5 py-3">
                        <RowActions p={p} onStock={() => recordMovement(p.id)} onEdit={() => setEditing({ open: true, product: p })} onDelete={() => setDeleting(p)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-3 sm:grid-cols-2 md:hidden [&>*]:min-w-0">
            {rows.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <ProductAvatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="font-mono text-xs text-muted">{p.sku}</p>
                  </div>
                  <RowActions p={p} onStock={() => recordMovement(p.id)} onEdit={() => setEditing({ open: true, product: p })} onDelete={() => setDeleting(p)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={stockStatus(p)} />
                  {p.categoryId && <Badge tone="primary">{catName.get(p.categoryId)}</Badge>}
                  {p.location && <Badge><MapPin className="size-3" />{p.location}</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                  <Stat label="On hand / min" value={`${p.quantity} / ${p.reorderLevel}`} />
                  <Stat label="Price" value={fmtCurrency(p.sellPrice)} />
                  <Stat label="Value" value={fmtCurrency(p.quantity * p.costPrice)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ProductForm open={editing.open} product={editing.product} onClose={() => setEditing({ open: false })} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete product?"
        message={<>This permanently removes <b className="text-text">{deleting?.name}</b> and its movement history.</>}
        onConfirm={() => remove(deleting!)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function ProductAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-xs font-bold text-primary">
      {initials}
    </span>
  );
}

function StockMeter({ p }: { p: Product }) {
  const st = stockStatus(p);
  const pct = Math.min(100, (p.quantity / Math.max(1, p.reorderLevel * 3)) * 100);
  return (
    <div className="w-28">
      <p className="text-sm font-medium tabular-nums">
        {p.quantity} <span className="text-xs font-normal text-muted">{p.unit} · min {p.reorderLevel}</span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", st === "in-stock" ? "bg-success" : st === "low-stock" ? "bg-warning" : "bg-danger")}
          style={{ width: `${Math.max(pct, st === "out-of-stock" ? 0 : 4)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RowActions({ p, onStock, onEdit, onDelete }: { p: Product; onStock: () => void; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const { can } = useAuth();
  const actions = [
    { label: "Record stock", icon: TrendingUp, fn: onStock, show: can("stock.record") },
    { label: "Edit", icon: Pencil, fn: onEdit, show: can("products.edit") },
    { label: "Delete", icon: Trash2, fn: onDelete, danger: true, show: can("products.delete") },
  ].filter((a) => a.show);
  if (!actions.length) return null;
  return (
    <div className="relative flex items-center justify-end gap-1">
      <span className={cn("hidden", can("stock.record") && "lg:block")}>
        <Button size="sm" variant="outline" onClick={onStock} aria-label={`Record stock for ${p.name}`}>
          <TrendingUp className="size-3.5" /> Stock
        </Button>
      </span>
      <Button size="icon" variant="ghost" className="size-8" onClick={() => setOpen((o) => !o)} aria-label="More actions" aria-expanded={open}>
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute top-9 right-0 z-20 w-44 overflow-hidden rounded-xl border border-border bg-surface-solid p-1 shadow-xl">
            {actions.map(({ label, icon: Icon, fn, danger }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); fn(); }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2",
                  danger ? "text-danger" : "text-text",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
