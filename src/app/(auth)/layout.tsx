"use client";

import { BarChart3, ShieldCheck, Zap } from "lucide-react";
import { BrandName, Logo } from "@/components/layout/Sidebar";
import { useBranding } from "@/components/theme/BrandingProvider";

const FEATURES = [
  { icon: BarChart3, title: "Live stock insight", body: "Values, low-stock alerts and movement trends at a glance." },
  { icon: ShieldCheck, title: "Role-based access", body: "Super Admin, Admin, Staff — or roles you define." },
  { icon: Zap, title: "Backed up automatically", body: "Scheduled and on-change backups, local or Supabase." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { appName, tagline, logo } = useBranding();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="app-backdrop" aria-hidden />

      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden p-10 text-primary-fg lg:flex lg:flex-col">
        <div className="bg-brand-gradient absolute inset-0" />
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-accent/45 blur-3xl" />
        <div className="absolute top-1/3 -left-16 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo src={logo} className="size-11 bg-white/15 shadow-none ring-1 ring-white/25" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">{appName}</p>
            {tagline && <p className="text-sm opacity-80">{tagline}</p>}
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl leading-tight font-bold tracking-tight">Every item, every movement, under control.</h2>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Icon className="size-5" /></span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm opacity-80">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs opacity-70">© {appName}</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Logo src={logo} className="size-11" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight"><BrandName name={appName} /></p>
            {tagline && <p className="text-sm text-muted">{tagline}</p>}
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
