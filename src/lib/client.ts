"use client";

import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  // Session expired mid-use: send the user to sign in (auth endpoints handle 401 themselves).
  if (res.status === 401 && !url.startsWith("/api/auth/") && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets all client state for the new session
    location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fieldErrors);
  return data as T;
}

const fetcher = <T,>(url: string) => api<T>(url);

export function useApi<T>(url: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(url, fetcher, { revalidateOnFocus: true, keepPreviousData: true, ...config });
}

/** Revalidate every cached API resource — mutations touch several views (stats, lists). */
export function refreshAll() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"));
}
