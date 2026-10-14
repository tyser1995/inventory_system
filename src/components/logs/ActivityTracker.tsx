"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Records each page a signed-in user opens (server decides whether page views are tracked). */
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    void fetch("/api/logs/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "page", path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}

/** Fire-and-forget audit event for client-only actions (e.g. CSV export). */
export function trackExport(what: "products.csv", count?: number) {
  void fetch("/api/logs/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "export", what, count }),
    keepalive: true,
  }).catch(() => undefined);
}
