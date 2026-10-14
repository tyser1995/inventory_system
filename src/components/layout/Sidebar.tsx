"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Cloud, HardDrive } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBranding } from "@/components/theme/BrandingProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useApi } from "@/lib/client";
import type { DashboardStats } from "@/lib/types";
import { LinkPendingSpinner } from "./NavigationProgress";
import { isActive, NAV } from "./nav";

export function Logo({ src, className }: { src: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL
    return <img src={src} alt="" className={cn("size-9 shrink-0 rounded-xl object-contain", className)} />;
  }
  return (
    <span className={cn("bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-primary-fg shadow-[0_8px_20px_-8px_var(--primary)]", className)}>
      <Boxes className="size-5" />
    </span>
  );
}

/** Splits the name so the second half wears the brand gradient (e.g. Stock|Vault). */
export function BrandName({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  let head: string, tail: string;
  if (words.length > 1) {
    head = words.slice(0, -1).join(" ") + " ";
    tail = words.at(-1)!;
  } else {
    const camel = name.slice(1).search(/[A-Z]/);
    [head, tail] = camel > 0 ? [name.slice(0, camel + 1), name.slice(camel + 1)] : [name, ""];
  }
  return (
    <>
      {head}
      {tail && <span className="text-gradient">{tail}</span>}
    </>
  );
}

export function Brand() {
  const { appName, tagline, logo } = useBranding();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 px-2">
      <Logo src={logo} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-bold tracking-tight">
          <BrandName name={appName} />
        </span>
        {tagline && <span className="block truncate text-[11px] font-medium text-muted max-sm:hidden">{tagline}</span>}
      </span>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, canAny } = useAuth();
  const { data: stats } = useApi<DashboardStats>(can("dashboard.view") ? "/api/stats" : null);
  const alerts = (stats?.lowStockCount ?? 0) + (stats?.outOfStockCount ?? 0);
  const items = NAV.filter((n) => !n.perms || canAny(...n.perms));

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "ring-focus group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {active && <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />}
            <Icon className="size-[18px]" />
            {label}
            <LinkPendingSpinner />
            {href === "/products" && alerts > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-fg">{alerts}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Shows which database is active; links to the Database settings tab. */
function DatabaseBadge() {
  const { can } = useAuth();
  const { data } = useApi<{ provider: "local" | "supabase"; supabase: { url: string } }>(
    can("settings.database") ? "/api/settings/database" : null,
  );
  if (!can("settings.database")) return null;
  const supabase = data?.provider === "supabase";
  const Icon = supabase ? Cloud : HardDrive;
  return (
    <Link href="/settings#database" className="ring-focus relative block overflow-hidden rounded-xl p-4 text-primary-fg">
      <div className="bg-brand-gradient absolute inset-0" />
      <div className="absolute -top-6 -right-6 size-24 rounded-full bg-accent/50 blur-2xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" /> {supabase ? "Supabase" : "Local database"}</p>
        <p className="mt-1 truncate text-xs opacity-85">
          {supabase ? data.supabase.url.replace(/^https?:\/\//, "") : <>Stored in <code className="font-mono">data/db.json</code></>}
        </p>
      </div>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-[var(--radius)] p-4 lg:flex">
      <Brand />
      <div className="mt-8 flex-1">
        <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted/80 uppercase">Menu</p>
        <SidebarNav />
      </div>
      <DatabaseBadge />
    </aside>
  );
}
