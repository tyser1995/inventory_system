"use client";

import { useEffect, useState } from "react";
import { Activity, Bug, Settings2 } from "lucide-react";
import { RequirePermission, useAuth } from "@/components/auth/AuthProvider";
import { ActivityLog } from "@/components/logs/ActivityLog";
import { ErrorLog } from "@/components/logs/ErrorLog";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "errors", label: "Errors", icon: Bug },
  { id: "settings", label: "Log settings", icon: Settings2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LogsView() {
  return (
    <RequirePermission perm="logs.view">
      <Logs />
    </RequirePermission>
  );
}

function Logs() {
  const [tab, setTab] = useState<TabId>("activity");
  const { data: errors } = useApi<{ stats: { open: number } }>("/api/logs/errors?days=30");

  useEffect(() => {
    const h = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab from URL hash on mount
    if (TABS.some((t) => t.id === h)) setTab(h as TabId);
  }, []);

  return (
    <>
      <PageHeader title="Logs" description="Who did what, when — and every error the app has hit" />
      <div className="glass mb-5 flex gap-1 overflow-x-auto rounded-[var(--radius)] p-1.5" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => { setTab(id); history.replaceState(null, "", `#${id}`); }}
            className={cn(
              "ring-focus flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[calc(var(--radius)*0.7)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all",
              tab === id ? "bg-primary text-primary-fg shadow-[0_6px_20px_-8px_var(--primary)]" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4" /> {label}
            {id === "errors" && !!errors?.stats.open && (
              <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === id ? "bg-white/25" : "bg-danger text-white")}>{errors.stats.open}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "activity" && <ActivityLog />}
      {tab === "errors" && <ErrorLog />}
      {tab === "settings" && <LogSettings />}
    </>
  );
}

function LogSettings() {
  const { can } = useAuth();
  const manage = can("logs.manage");
  const { data } = useApi<{ retentionDays: number; trackPageViews: boolean; storageBytes: number }>("/api/logs/settings");
  if (!data) return <Skeleton className="h-64" />;
  return <LogSettingsForm key={JSON.stringify(data)} initial={data} manage={manage} />;
}

function LogSettingsForm({ initial, manage }: { initial: { retentionDays: number; trackPageViews: boolean; storageBytes: number }; manage: boolean }) {
  const [form, setForm] = useState({ retentionDays: initial.retentionDays, trackPageViews: initial.trackPageViews });
  const { busy, errors, submit } = useFormSubmit();
  const dirty = form.retentionDays !== initial.retentionDays || form.trackPageViews !== initial.trackPageViews;
  const size = initial.storageBytes < 1048576 ? `${(initial.storageBytes / 1024).toFixed(1)} KB` : `${(initial.storageBytes / 1048576).toFixed(1)} MB`;

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Log settings" subtitle={`Logs are stored on this server in data/logs · currently ${size}`} />
      <form
        className="space-y-5 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await submit(() => api("/api/logs/settings", { method: "PUT", json: form }), "Log settings saved");
        }}
      >
        <div className="rounded-xl border border-border p-4">
          <Switch
            checked={form.trackPageViews}
            onChange={(trackPageViews) => setForm((f) => ({ ...f, trackPageViews }))}
            label="Track page views"
            description="Record every page each user opens. Sign-ins, changes and denied access are always logged."
            disabled={!manage}
          />
        </div>
        <Field label="Keep logs for" error={errors.retentionDays} hint="Older activity and error logs are deleted automatically each day">
          <Select value={form.retentionDays} onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))} disabled={!manage} className="max-w-56">
            {[7, 30, 90, 180, 365, 730].map((d) => <option key={d} value={d}>{d < 365 ? `${d} days` : `${d / 365} year${d > 365 ? "s" : ""}`}</option>)}
          </Select>
        </Field>
        {manage ? (
          <Button type="submit" loading={busy} disabled={!dirty}>Save settings</Button>
        ) : (
          <p className="text-xs text-muted">You need the “Resolve errors & log settings” permission to change these.</p>
        )}
      </form>
    </Card>
  );
}
