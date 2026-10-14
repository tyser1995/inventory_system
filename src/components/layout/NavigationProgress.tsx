"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

const START_EVENT = "app:navigation-start";

/** Starts the top progress bar for navigations not triggered by a link click (e.g. router.push). */
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

function isInternalNavigation(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  // Same page (or only a hash change) isn't a page navigation.
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return url.pathname + url.search;
}

/**
 * Slim top progress bar: starts when an internal link is clicked and completes
 * when the new route renders (pathname/search change).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const start = () => {
      clear();
      setProgress(8);
      // Ease towards 90% while waiting; completion jumps to 100%.
      [[150, 30], [400, 55], [900, 72], [1800, 85], [4000, 90]].forEach(([ms, v]) =>
        timers.current.push(setTimeout(() => setProgress((p) => (p === null ? p : Math.max(p, v))), ms)),
      );
      // Safety net if the navigation never completes (e.g. it was cancelled).
      timers.current.push(setTimeout(() => setProgress(null), 15_000));
    };
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      clear();
    };
  }, []);

  // Route changed → finish the bar.
  useEffect(() => {
    setProgress((p) => {
      if (p === null) return p;
      clear();
      timers.current.push(setTimeout(() => setProgress(null), 250));
      return 100;
    });
  }, [pathname, search]);

  if (progress === null) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]" role="progressbar" aria-label="Loading page" aria-valuenow={progress}>
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_var(--primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}

/** Small spinner shown inside a <Link> while its navigation is pending. */
export function LinkPendingSpinner({ className = "size-3.5" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className={`${className} shrink-0 animate-spin`} aria-label="Loading" /> : null;
}
