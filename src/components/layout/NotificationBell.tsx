"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, BellOff, BellRing, CheckCheck, PackageCheck, PackageX, Settings2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtRelative } from "@/lib/format";
import type { AlertKind, StockAlert } from "@/lib/types";
import { useQuickActions } from "./AppShell";
import { startNavigationProgress } from "./NavigationProgress";

type Item = Omit<StockAlert, "readBy"> & { read: boolean };

const KIND: Record<AlertKind, { icon: typeof Bell; cls: string; title: (a: Item) => string }> = {
  "out-of-stock": { icon: PackageX, cls: "bg-danger/10 text-danger", title: (a) => `${a.productName} is out of stock` },
  "low-stock": { icon: AlertTriangle, cls: "bg-warning/14 text-warning", title: (a) => `${a.productName} is running low` },
  restocked: { icon: PackageCheck, cls: "bg-success/12 text-success", title: (a) => `${a.productName} is back in stock` },
};

export const alertBody = (a: Pick<Item, "kind" | "quantity" | "minLevel" | "unit">) =>
  a.kind === "out-of-stock"
    ? `0 ${a.unit} left · minimum ${a.minLevel}`
    : `${a.quantity} ${a.unit} left · minimum ${a.minLevel}`;

const DESKTOP_KEY = "inventory.desktopAlerts";

/** Header bell: unread stock alerts, polled every 30s, with optional desktop notifications. */
export function NotificationBell() {
  const { can } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { recordMovement } = useQuickActions();
  const { data, mutate } = useApi<{ items: Item[]; unread: number }>("/api/alerts", { refreshInterval: 30_000 });
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read per-browser preference after mount
      setDesktop(localStorage.getItem(DESKTOP_KEY) === "1" && "Notification" in window && Notification.permission === "granted");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Announce alerts that arrived since the last poll (not the ones present on first load).
  useEffect(() => {
    if (!data) return;
    if (!seen.current) {
      seen.current = new Set(data.items.map((i) => i.id));
      return;
    }
    const fresh = data.items.filter((i) => !seen.current!.has(i.id) && !i.read);
    for (const i of data.items) seen.current.add(i.id);
    for (const a of fresh.slice(0, 3)) {
      const title = KIND[a.kind].title(a);
      toast(`${title} — ${alertBody(a)}`, a.kind === "restocked" ? "success" : "error");
      if (desktop && document.visibilityState !== "visible") {
        try {
          new Notification(title, { body: alertBody(a), icon: "/api/branding/logo", tag: a.id });
        } catch {
          /* notifications unsupported */
        }
      }
    }
  }, [data, desktop, toast]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ids?: string[]) {
    await api("/api/alerts/read", { method: "POST", json: { ids } }).catch(() => undefined);
    await mutate();
  }

  async function toggleDesktop() {
    if (desktop) {
      setDesktop(false);
      try { localStorage.setItem(DESKTOP_KEY, "0"); } catch { /* ignore */ }
      return;
    }
    if (!("Notification" in window)) return toast("This browser doesn't support desktop notifications", "error");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return toast("Desktop notifications were blocked in the browser", "error");
    setDesktop(true);
    try { localStorage.setItem(DESKTOP_KEY, "1"); } catch { /* ignore */ }
    toast("Desktop alerts on — you'll be notified even when this tab is in the background");
  }

  const unread = data?.unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label={`Stock alerts${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative">
        {unread ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-[var(--surface-solid)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="animate-pop fixed inset-x-3 top-[5.5rem] z-50 flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface-solid shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold">Stock alerts</p>
              <p className="text-xs text-muted">{unread ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="size-8" onClick={toggleDesktop} title={desktop ? "Turn off desktop alerts" : "Turn on desktop alerts"} aria-pressed={desktop}>
                {desktop ? <BellRing className="size-4 text-primary" /> : <BellOff className="size-4" />}
              </Button>
              {unread > 0 && (
                <Button size="sm" variant="ghost" onClick={() => markRead()}><CheckCheck className="size-3.5" /> Mark all read</Button>
              )}
            </div>
          </div>

          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {!data?.items.length ? (
              <li className="px-4 py-10 text-center text-sm text-muted">
                <Bell className="mx-auto mb-2 size-6 opacity-50" />
                No alerts yet. You&apos;ll be notified when a product reaches its minimum stock.
              </li>
            ) : (
              data.items.map((a) => {
                const k = KIND[a.kind];
                return (
                  <li key={a.id} className={cn("flex gap-3 px-4 py-3", !a.read && "bg-primary/[0.04]")}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", k.cls)}><k.icon className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <button
                        className="block w-full cursor-pointer text-left"
                        onClick={() => {
                          void markRead([a.id]);
                          setOpen(false);
                          startNavigationProgress();
                          router.push(`/products?q=${encodeURIComponent(a.sku)}`);
                        }}
                      >
                        <p className={cn("text-sm", !a.read ? "font-semibold" : "font-medium")}>{k.title(a)}</p>
                        <p className="text-xs text-muted">{alertBody(a)} · {fmtRelative(a.createdAt)}</p>
                      </button>
                      {a.kind !== "restocked" && can("stock.record") && (
                        <button
                          onClick={() => { void markRead([a.id]); setOpen(false); recordMovement(a.productId); }}
                          className="mt-1.5 cursor-pointer text-xs font-semibold text-primary hover:underline"
                        >
                          Restock now →
                        </button>
                      )}
                    </div>
                    {!a.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </li>
                );
              })
            )}
          </ul>

          {can("settings.alerts") && (
            <Link href="/settings#alerts" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-semibold text-muted hover:text-text">
              <Settings2 className="size-3.5" /> Alert settings &amp; minimum stock
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
