"use client";

import { useEffect } from "react";

const recent = new Map<string, number>();

/** Sends a browser error to the server error log (deduplicated for 10s, never throws). */
export function reportClientError(err: unknown, kind: "error" | "unhandledrejection" | "boundary", digest?: string) {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err) ?? "Unknown error");
  const key = `${kind}:${e.message}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 10_000) return;
  recent.set(key, now);
  void fetch("/api/logs/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: e.message || "Unknown error", stack: e.stack?.slice(0, 8000), url: location.href, digest, kind }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Captures uncaught errors and unhandled promise rejections anywhere in the app. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      // Ignore noise from browser extensions and cross-origin scripts.
      if (!ev.error && ev.message === "Script error.") return;
      if (ev.filename && !ev.filename.startsWith(location.origin)) return;
      reportClientError(ev.error ?? ev.message, "error");
    };
    const onRejection = (ev: PromiseRejectionEvent) => reportClientError(ev.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
