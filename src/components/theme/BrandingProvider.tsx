"use client";

import { createContext, useContext } from "react";
import { useApi } from "@/lib/client";
import type { Branding } from "@/lib/types";

const BrandingContext = createContext<Branding | null>(null);

/** Seeds SWR with server-rendered branding so the name/logo never flash on load. */
export function BrandingProvider({ initial, children }: { initial: Branding; children: React.ReactNode }) {
  const { data } = useApi<Branding>("/api/branding", { fallbackData: initial });
  return <BrandingContext.Provider value={data ?? initial}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
