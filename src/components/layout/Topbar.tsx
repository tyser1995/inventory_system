"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Moon, Palette, Plus, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeCustomizer } from "@/components/theme/ThemeCustomizer";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { Brand } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { startNavigationProgress } from "./NavigationProgress";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/cn";

export function Topbar({ onMenu, onQuickAdd }: { onMenu: () => void; onQuickAdd: () => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { can } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Ctrl/⌘ + K focuses global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setPaletteOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPaletteOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [paletteOpen]);

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 lg:px-0">
      <div className="glass flex h-16 items-center gap-2 rounded-[var(--radius)] !bg-[color-mix(in_oklab,var(--surface-solid)_88%,transparent)] px-3 shadow-sm sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <div className="lg:hidden">
          <Brand />
        </div>

        <form
          className={cn("relative hidden max-w-md flex-1", can("products.view") && "md:block")}
          onSubmit={(e) => {
            e.preventDefault();
            startNavigationProgress();
            router.push(`/products?q=${encodeURIComponent(query)}`);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, SKUs…"
            className="ring-focus h-10 w-full rounded-[calc(var(--radius)*0.7)] border border-border bg-surface-2/70 pr-14 pl-9 text-sm placeholder:text-muted/80 focus:border-primary"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-border bg-surface-solid px-1.5 py-0.5 font-mono text-[10px] text-muted">
            Ctrl K
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Theme controls live in Settings → Appearance on phones to keep the header from overflowing. */}
          <span className="hidden sm:contents">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme({ mode: document.documentElement.dataset.theme === "dark" ? "light" : "dark" })}
            aria-label="Toggle dark mode"
          >
            {/* CSS-driven so server and client markup match regardless of stored theme. */}
            <Sun className="hidden size-5 dark:block" />
            <Moon className="size-5 dark:hidden" />
          </Button>

          <div className="relative" ref={popRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPaletteOpen((o) => !o)}
              aria-label="Customize theme"
              aria-expanded={paletteOpen}
            >
              <Palette className="size-5" />
            </Button>
            {paletteOpen && (
              <div className="animate-pop fixed inset-x-3 top-[5.5rem] z-50 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[var(--radius)] border border-border bg-surface-solid p-5 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
                <p className="mb-4 font-semibold">Theme studio</p>
                <ThemeCustomizer compact />
              </div>
            )}
          </div>
          </span>

          {can("products.view") && <NotificationBell />}
          {can("stock.record") && (
            <span className="hidden sm:block">
              <Button onClick={onQuickAdd}>
                <Plus className="size-4" /> Record stock
              </Button>
            </span>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
