"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { MovementForm } from "@/components/forms/MovementForm";
import { ActivityTracker } from "@/components/logs/ActivityTracker";
import { cn } from "@/lib/cn";
import { BackToTop } from "./BackToTop";
import { MobileNav } from "./MobileNav";
import { NavigationProgress } from "./NavigationProgress";
import { Brand, Sidebar, SidebarNav } from "./Sidebar";
import { Topbar } from "./Topbar";

const QuickActions = createContext<{ recordMovement: (productId?: string) => void }>({ recordMovement: () => {} });
export const useQuickActions = () => useContext(QuickActions);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [movement, setMovement] = useState<{ open: boolean; productId?: string }>({ open: false });
  const pathname = usePathname();

  // Close the mobile drawer on route change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDrawer(false), [pathname]);

  const recordMovement = useCallback((productId?: string) => setMovement({ open: true, productId }), []);

  return (
    <QuickActions.Provider value={{ recordMovement }}>
      <ActivityTracker />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <div className="app-backdrop" aria-hidden />
      <Sidebar />

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", drawer ? "visible" : "invisible")} aria-hidden={!drawer}>
        <div
          className={cn("absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity", drawer ? "opacity-100" : "opacity-0")}
          onClick={() => setDrawer(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface-solid p-4 shadow-2xl transition-transform duration-200",
            drawer ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <Brand />
            <button onClick={() => setDrawer(false)} className="ring-focus rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      <div className="min-h-dvh lg:pl-[17.5rem] lg:pr-3">
        <Topbar onMenu={() => setDrawer(true)} onQuickAdd={() => recordMovement()} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-32 sm:px-6 lg:px-3 lg:pb-10">{children}</main>
      </div>

      <BackToTop />
      <MobileNav onQuickAdd={() => recordMovement()} />
      <MovementForm open={movement.open} productId={movement.productId} onClose={() => setMovement({ open: false })} />
    </QuickActions.Provider>
  );
}
