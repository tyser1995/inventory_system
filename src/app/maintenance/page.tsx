"use client";

import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { Logo } from "@/components/layout/Sidebar";
import { useBranding } from "@/components/theme/BrandingProvider";
import { Button } from "@/components/ui/Button";

/** Shown for every page while NEXT_PUBLIC_MAINTENANCE_MODE=true (see src/proxy.ts). */
export default function MaintenancePage() {
  const router = useRouter();
  const { appName, logo } = useBranding();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="app-backdrop" aria-hidden />
      <div className="glass relative w-full max-w-md rounded-2xl p-8 text-center">
        <Logo src={logo} className="mx-auto size-12" />
        <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
          <Wrench className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Under maintenance</h1>
        <p className="mt-2 text-sm text-muted">
          {appName} is getting some updates and will be back shortly. Thanks for your patience.
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          Try again
        </Button>
      </div>
    </main>
  );
}
