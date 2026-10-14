"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Boxes, LayoutDashboard, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Permission } from "@/lib/auth/permissions";
import { LinkPendingSpinner } from "./NavigationProgress";
import { isActive } from "./nav";

type Item = { href: string; label: string; icon: typeof Boxes; perm?: Permission };
const LEFT: Item[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, perm: "dashboard.view" },
  { href: "/products", label: "Products", icon: Boxes, perm: "products.view" },
];
const RIGHT: Item[] = [
  { href: "/movements", label: "Stock", icon: ArrowLeftRight, perm: "movements.view" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const allowed = (i: Item) => !i.perm || can(i.perm);
  const item = ({ href, label, icon: Icon }: Item) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold", active ? "text-primary" : "text-muted")}
      >
        <span className="relative">
          <Icon className="size-5" />
          <span className="absolute -top-1 -right-2.5"><LinkPendingSpinner className="size-3" /></span>
        </span>
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="glass flex items-center rounded-[var(--radius)] px-2 shadow-xl">
        {LEFT.filter(allowed).map(item)}
        {can("stock.record") && <div className="flex flex-1 justify-center">
          <button
            onClick={onQuickAdd}
            aria-label="Record stock movement"
            className="ring-focus -mt-7 grid size-14 cursor-pointer place-items-center rounded-2xl bg-accent text-accent-fg shadow-[0_10px_25px_-8px_var(--accent)] ring-4 ring-bg transition-transform active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>}
        {RIGHT.filter(allowed).map(item)}
      </div>
    </nav>
  );
}
