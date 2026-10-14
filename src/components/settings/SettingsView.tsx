"use client";

import { useEffect, useState } from "react";
import { Archive, BellRing, Database, FlaskConical, Paintbrush, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RolesSettings } from "@/components/settings/RolesSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";
import type { Permission } from "@/lib/auth/permissions";
import { BrandName } from "@/components/layout/Sidebar";
import { AlertSettings } from "@/components/settings/AlertSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { DatabaseSettings } from "@/components/settings/DatabaseSettings";
import { useBranding } from "@/components/theme/BrandingProvider";
import { ThemeCustomizer } from "@/components/theme/ThemeCustomizer";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { fmtCurrency } from "@/lib/format";

const TABS = [
  { id: "general", label: "General", icon: SlidersHorizontal, perms: ["settings.branding"] },
  { id: "appearance", label: "Appearance", icon: Paintbrush, perms: [] },
  { id: "alerts", label: "Alerts", icon: BellRing, perms: ["settings.alerts", "products.edit"] },
  { id: "users", label: "Users", icon: Users, perms: ["users.manage"] },
  { id: "roles", label: "Roles", icon: ShieldCheck, perms: ["roles.manage"] },
  { id: "backups", label: "Backups", icon: Archive, perms: ["settings.backup"] },
  { id: "data", label: "Data", icon: FlaskConical, perms: ["data.reset"] },
  { id: "database", label: "Database", icon: Database, perms: ["settings.database"] },
] as const satisfies readonly { id: string; label: string; icon: unknown; perms: readonly Permission[] }[];

type TabId = (typeof TABS)[number]["id"];
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

export function SettingsView() {
  const { canAny } = useAuth();
  const visible = TABS.filter((t) => t.perms.length === 0 || canAny(...t.perms));
  const [chosen, setTab] = useState<TabId>(visible[0].id);
  // Fall back to the first visible tab if the chosen one isn't allowed.
  const tab = visible.some((t) => t.id === chosen) ? chosen : visible[0].id;

  // Deep-linkable tabs via #hash (e.g. /settings#backups).
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) setTab(h);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function select(id: TabId) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <>
      <PageHeader title="Settings" description="Personalize the workspace, protect your data and choose where it lives" />

      <div className="glass mb-5 flex gap-1 overflow-x-auto rounded-[var(--radius)] p-1.5" role="tablist">
        {visible.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => select(id)}
            className={cn(
              "ring-focus flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[calc(var(--radius)*0.7)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all",
              tab === id ? "bg-primary text-primary-fg shadow-[0_6px_20px_-8px_var(--primary)]" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "general" && (
          <Card>
            <CardHeader title="Branding" subtitle="Rename the application and upload your own logo" />
            <BrandingSettings />
          </Card>
        )}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "users" && <UsersSettings />}
        {tab === "roles" && <RolesSettings />}
        {tab === "backups" && <BackupSettings />}
        {tab === "alerts" && <AlertSettings />}
        {tab === "data" && <DataSettings />}
        {tab === "database" && <DatabaseSettings />}
      </div>
    </>
  );
}

function AppearanceTab() {
  const { appName } = useBranding();
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader title="Theme studio" subtitle="Colors apply instantly and are saved to this browser" />
        <div className="p-5">
          <ThemeCustomizer />
        </div>
      </Card>
      <Card className="h-fit lg:col-span-2">
        <CardHeader title="Live preview" subtitle="How components look with your palette" />
        <div className="space-y-4 p-5">
          <div className="bg-brand-gradient relative overflow-hidden rounded-xl p-5 text-primary-fg">
            <div className="absolute -right-6 -bottom-8 size-28 rounded-full bg-accent/50 blur-2xl" />
            <p className="relative text-xs opacity-85">Inventory value</p>
            <p className="relative mt-1 text-2xl font-bold">{fmtCurrency(128450)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="accent">Accent</Button>
            <Button size="sm" variant="outline">Outline</Button>
          </div>
          <p className="truncate text-2xl font-bold tracking-tight"><BrandName name={appName} /></p>
        </div>
      </Card>
    </div>
  );
}
