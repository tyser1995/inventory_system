"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { DemoStatus } from "@/components/settings/DataSettings";
import { NAV } from "@/components/layout/nav";
import { AlertTriangle, ArrowRight, ArrowUpRight, FlaskConical, Boxes, Package, PackageX, PhilippinePeso, TrendingUp } from "lucide-react";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { TrendChart } from "@/components/charts/TrendChart";
import { useQuickActions } from "@/components/layout/AppShell";
import { MovementRow } from "@/components/MovementRow";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { stockStatus } from "@/lib/stock";
import type { DashboardStats } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { can, canAny } = useAuth();
  const router = useRouter();
  const allowed = can("dashboard.view");

  // Users without dashboard access land on the first page they can see.
  useEffect(() => {
    if (allowed) return;
    const first = NAV.find((n) => n.href !== "/" && (!n.perms || canAny(...n.perms)));
    router.replace(first?.href ?? "/settings");
  }, [allowed, canAny, router]);

  return allowed ? <Dashboard /> : null;
}

function Dashboard() {
  const { can } = useAuth();
  const { data: s, isLoading } = useApi<DashboardStats>("/api/stats");
  const { recordMovement } = useQuickActions();

  if (isLoading || !s) return <DashboardSkeleton />;

  const margin = s.retailValue - s.inventoryValue;
  const kpis = [
    { label: "Inventory value", value: fmtCurrency(s.inventoryValue), sub: `${fmtCurrency(margin)} potential profit`, icon: PhilippinePeso, hero: true, href: "/products?sort=value" },
    { label: "Products", value: fmtNumber(s.totalProducts), sub: `${fmtNumber(s.totalUnits)} units on hand`, icon: Package, href: "/products" },
    { label: "Low stock", value: fmtNumber(s.lowStockCount), sub: "At or below minimum stock", icon: AlertTriangle, tone: "accent" as const, href: "/products?status=low-stock" },
    { label: "Out of stock", value: fmtNumber(s.outOfStockCount), sub: "Needs replenishment", icon: PackageX, tone: "danger" as const, href: "/products?status=out-of-stock" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{greeting()} 👋</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Inventory <span className="text-gradient">overview</span>
          </h1>
          <DemoPill />
        </div>
        <div className="flex gap-2">
          {can("products.view") && <Link href="/products"><Button variant="outline"><Boxes className="size-4" /> Products</Button></Link>}
          {can("stock.record") && <Button variant="accent" onClick={() => recordMovement()}><TrendingUp className="size-4" /> Record stock</Button>}
        </div>
      </div>

      {/* KPI bento */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: Icon, hero, tone, href }) => (
          <KpiLink
            key={label}
            href={can("products.view") ? href : undefined}
            label={label}
            className={cn((hero || label === "Products") && "col-span-2 lg:col-span-1")}
          >
          <Card className={cn("relative h-full overflow-hidden p-4 sm:p-5", hero && "border-transparent text-primary-fg")}>
            {hero && (
              <>
                <div className="bg-brand-gradient absolute inset-0" />
                <div className="absolute -right-10 -bottom-12 size-40 rounded-full bg-accent/45 blur-3xl" />
              </>
            )}
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold tracking-wide uppercase sm:text-[13px] sm:normal-case sm:tracking-normal", hero ? "opacity-85" : "text-muted")}>{label}</p>
                <p className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
                <p className={cn("mt-1 truncate text-xs", hero ? "opacity-80" : "text-muted")}>{sub}</p>
              </div>
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  hero ? "bg-white/15" : tone === "accent" ? "bg-accent/15 text-[color-mix(in_oklab,var(--accent)_65%,var(--text))]" : tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-5" />
              </span>
            </div>
            {can("products.view") && (
              <ArrowUpRight
                className={cn(
                  "absolute right-3 bottom-3 size-4 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70",
                  hero ? "text-primary-fg" : "text-muted",
                )}
                aria-hidden
              />
            )}
          </Card>
          </KpiLink>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Stock flow"
            subtitle="Units moved per day · last 14 days"
            action={can("movements.view") ? <Link href="/movements" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ledger <ArrowRight className="size-3.5" /></Link> : undefined}
          />
          <div className="p-5 pt-4">
            <TrendChart data={s.movementTrend} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Value by category" subtitle="At cost price" />
          <div className="p-5 pt-5">
            {s.categoryBreakdown.length ? <CategoryBars data={s.categoryBreakdown} hrefFor={can("products.view") ? (id) => `/products?category=${id ?? "none"}` : undefined} /> : <p className="text-sm text-muted">No data yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader
            title="Needs attention"
            subtitle="At or below their minimum stock level"
            action={<Link href="/products?status=attention" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>}
          />
          {s.lowStock.length === 0 ? (
            <EmptyState icon={Package} title="All stocked up" description="Nothing is at or below its minimum stock." />
          ) : (
            <ul className="divide-y divide-border px-5 pb-2">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Link href={`/products?q=${encodeURIComponent(p.sku)}`} className="group/row ring-focus min-w-0 flex-1 rounded-md">
                    <p className="truncate text-sm font-medium group-hover/row:text-primary group-hover/row:underline">{p.name}</p>
                    <p className="font-mono text-xs text-muted">{p.sku}</p>
                  </Link>
                  <div className="hidden text-right text-xs sm:block">
                    <p className="font-semibold tabular-nums">{p.quantity} / {p.reorderLevel}</p>
                    <p className="text-muted">on hand / min</p>
                  </div>
                  <StatusBadge status={stockStatus(p)} />
                  {can("stock.record") && <Button size="sm" variant="outline" onClick={() => recordMovement(p.id)}>Restock</Button>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Latest stock movements"
            action={<Link href="/movements" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ledger <ArrowRight className="size-3.5" /></Link>}
          />
          {s.recentMovements.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No movements yet" />
          ) : (
            <ul className="divide-y divide-border px-5 pb-2">
              {s.recentMovements.map((m) => (
                <MovementRow key={m.id} m={m} href={can("movements.view") ? `/movements?q=${encodeURIComponent(m.sku)}` : undefined} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Tells users when the numbers include sample data (with a shortcut for those who can switch it off). */
function DemoPill() {
  const { can } = useAuth();
  const { data } = useApi<DemoStatus>("/api/demo");
  if (!data?.enabled || !data.counts.products) return null;
  const pill = (
    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-[color-mix(in_oklab,var(--accent)_65%,var(--text))]">
      <FlaskConical className="size-3.5" /> Includes {data.counts.products} demo products
    </span>
  );
  return can("data.reset") ? <Link href="/settings#data" title="Manage demo data">{pill}</Link> : pill;
}

/** Wraps a KPI card in a link (keyboard-focusable, with hover lift) when it has a destination. */
function KpiLink({ href, label, className, children }: { href?: string; label: string; className?: string; children: React.ReactNode }) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={`${label}: view details`}
      className={cn("group ring-focus block rounded-[var(--radius)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0", className)}
    >
      {children}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className={cn("h-32", i < 2 && "col-span-2 lg:col-span-1")} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
