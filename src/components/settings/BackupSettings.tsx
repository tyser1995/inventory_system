"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, CalendarClock, Download, FileUp, Hand, History, RotateCcw, ShieldCheck, Trash2, Upload, Zap,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtNumber, fmtRelative } from "@/lib/format";

type Kind = "manual" | "auto" | "scheduled" | "safety" | "imported";

interface Backup {
  id: string;
  kind: Kind;
  label?: string;
  createdAt: string;
  provider: string;
  size: number;
  counts: { products: number; categories: number; suppliers: number; movements: number };
}

interface Policy {
  auto: { enabled: boolean; intervalMinutes: number };
  safety: boolean;
  schedule: { enabled: boolean; frequency: "hourly" | "6h" | "12h" | "daily" | "weekly"; time: string; weekday: number };
  retention: number;
}

const KIND: Record<Kind, { label: string; icon: typeof Hand; tone: Tone }> = {
  manual: { label: "Manual", icon: Hand, tone: "primary" },
  auto: { label: "Auto", icon: Zap, tone: "accent" },
  scheduled: { label: "Scheduled", icon: CalendarClock, tone: "success" },
  safety: { label: "Safety", icon: ShieldCheck, tone: "warning" },
  imported: { label: "Imported", icon: FileUp, tone: "neutral" },
};

const INTERVALS = [
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Once a day" },
];
const FREQUENCIES = [
  { value: "hourly", label: "Hourly" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function BackupSettings() {
  const { data, isLoading } = useApi<{ backups: Backup[]; nextScheduledAt: string | null }>("/api/backups");
  const { data: policy } = useApi<Policy>("/api/settings/backup");
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [confirm, setConfirm] = useState<{ type: "restore" | "delete"; backup: Backup } | null>(null);

  const backups = data?.backups ?? [];
  const shown = filter === "all" ? backups : backups.filter((b) => b.kind === filter);
  const totalSize = backups.reduce((s, b) => s + b.size, 0);

  async function backupNow() {
    setCreating(true);
    try {
      await api("/api/backups", { method: "POST", json: { label } });
      setLabel("");
      await refreshAll();
      toast("Backup created");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      await api(`/api/backups/import?name=${encodeURIComponent(file.name)}`, { method: "POST", body: await file.text() });
      await refreshAll();
      toast("File imported — restore it from the list below");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function onConfirm() {
    if (!confirm) return;
    const { type, backup } = confirm;
    try {
      if (type === "restore") {
        await api(`/api/backups/${backup.id}/restore`, { method: "POST" });
        await refreshAll();
        router.refresh();
        toast("Backup restored");
      } else {
        await api(`/api/backups/${backup.id}`, { method: "DELETE" });
        await refreshAll();
        toast("Backup deleted");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Status tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={History} label="Last backup" value={backups[0] ? fmtRelative(backups[0].createdAt) : "Never"} sub={backups[0] ? KIND[backups[0].kind].label : "Create your first backup"} />
        <StatTile icon={CalendarClock} label="Next scheduled" value={data?.nextScheduledAt ? fmtWhen(data.nextScheduledAt) : "Off"} sub={policy?.schedule.enabled ? FREQUENCIES.find((f) => f.value === policy.schedule.frequency)?.label : "Schedule disabled"} />
        <StatTile icon={Zap} label="Auto backup" value={policy?.auto.enabled ? "On" : "Off"} sub={policy?.auto.enabled ? INTERVALS.find((i) => i.value === policy.auto.intervalMinutes)?.label ?? `Every ${policy.auto.intervalMinutes} min` : "After data changes"} />
        <StatTile icon={Archive} label="Stored" value={fmtNumber(backups.length)} sub={fmtSize(totalSize)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Manual backup + import */}
        <Card className="lg:col-span-2">
          <CardHeader title="Manual backup" subtitle="Snapshot everything right now" />
          <div className="space-y-4 p-5">
            <Field label="Label (optional)">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Before stock take" maxLength={80} onKeyDown={(e) => e.key === "Enter" && backupNow()} />
            </Field>
            <Button onClick={backupNow} loading={creating} className="w-full justify-center">
              <Archive className="size-4" /> Back up now
            </Button>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-semibold">Import a backup file</p>
              <p className="mb-3 text-xs text-muted">Accepts a downloaded backup or a raw db.json. It is added to the list; nothing changes until you restore it.</p>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full justify-center">
                <Upload className="size-4" /> Choose file…
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
        </Card>

        {/* Policy */}
        <Card className="lg:col-span-3">
          <CardHeader title="Automation" subtitle="Runs on this server while the app is running" />
          {policy ? <PolicyForm policy={policy} /> : <div className="p-5"><Skeleton className="h-64" /></div>}
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader
          title="Backup history"
          subtitle="Newest first · auto & scheduled backups are pruned by the retention limit"
        />
        <div className="flex gap-1 overflow-x-auto px-5 pt-4">
          {(["all", "manual", "auto", "scheduled", "safety", "imported"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "ring-focus shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filter === k ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-text",
              )}
            >
              {k === "all" ? `All (${backups.length})` : `${KIND[k].label} (${backups.filter((b) => b.kind === k).length})`}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Archive} title="No backups yet" description="Create a manual backup or turn on automation above." />
        ) : (
          <ul className="divide-y divide-border px-5 pb-2">
            {shown.map((b) => {
              const k = KIND[b.kind];
              return (
                <li key={b.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><k.icon className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{b.label || fmtWhen(b.createdAt)}</span>
                        <Badge tone={k.tone}>{k.label}</Badge>
                        <Badge>{b.provider === "supabase" ? "Supabase" : "Local"}</Badge>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {b.label && <>{fmtWhen(b.createdAt)} · </>}
                        {b.counts.products} products · {b.counts.movements} movements · {fmtSize(b.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5 pl-13 sm:pl-0">
                    <a href={`/api/backups/${b.id}`} download>
                      <Button size="sm" variant="outline" tabIndex={-1}><Download className="size-3.5" /> Download</Button>
                    </a>
                    <Button size="sm" variant="outline" onClick={() => setConfirm({ type: "restore", backup: b })}><RotateCcw className="size-3.5" /> Restore</Button>
                    <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setConfirm({ type: "delete", backup: b })} aria-label="Delete backup"><Trash2 className="size-3.5" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === "restore" ? "Restore this backup?" : "Delete this backup?"}
        message={
          confirm?.type === "restore" ? (
            <>All current data will be replaced with the snapshot from <b className="text-text">{confirm && fmtWhen(confirm.backup.createdAt)}</b> ({confirm?.backup.counts.products} products).{policy?.safety && " A safety backup of the current data is taken first."}</>
          ) : (
            "This backup file will be permanently deleted."
          )
        }
        confirmLabel={confirm?.type === "restore" ? "Restore" : "Delete"}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub }: { icon: typeof History; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted"><Icon className="size-3.5 text-primary" /> {label}</div>
      <p className="mt-2 truncate text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Only the user-editable fields (the API also returns lastAutoAt/lastScheduledAt). */
const editable = ({ auto, safety, schedule, retention }: Policy): Policy => ({ auto, safety, schedule, retention });

function PolicyForm({ policy }: { policy: Policy }) {
  const [form, setForm] = useState<Policy>(() => editable(policy));
  const { busy, errors, submit } = useFormSubmit();
  const dirty = JSON.stringify(form) !== JSON.stringify(editable(policy));
  const set = <K extends keyof Policy>(k: K, v: Partial<Policy[K]> | Policy[K]) =>
    setForm((f) => ({ ...f, [k]: typeof v === "object" ? { ...(f[k] as object), ...v } : v }));

  return (
    <form
      className="space-y-5 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit(() => api("/api/settings/backup", { method: "PUT", json: form }), "Backup settings saved");
      }}
    >
      <div className="space-y-3 rounded-xl border border-border p-4">
        <Switch
          checked={form.auto.enabled}
          onChange={(enabled) => set("auto", { enabled })}
          label="Auto backup"
          description="Back up automatically after data changes, at most once per interval"
        />
        {form.auto.enabled && (
          <Field label="Frequency" error={errors["auto.intervalMinutes"]}>
            <Select value={form.auto.intervalMinutes} onChange={(e) => set("auto", { intervalMinutes: Number(e.target.value) })}>
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <Switch
          checked={form.schedule.enabled}
          onChange={(enabled) => set("schedule", { enabled })}
          label="Scheduled backup"
          description="Back up at fixed times, whether or not data changed"
        />
        {form.schedule.enabled && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Repeat" error={errors["schedule.frequency"]}>
              <Select value={form.schedule.frequency} onChange={(e) => set("schedule", { frequency: e.target.value as Policy["schedule"]["frequency"] })}>
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
            {form.schedule.frequency === "weekly" && (
              <Field label="Day" error={errors["schedule.weekday"]}>
                <Select value={form.schedule.weekday} onChange={(e) => set("schedule", { weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </Select>
              </Field>
            )}
            <Field label={form.schedule.frequency === "hourly" ? "At minute" : "Time"} error={errors["schedule.time"]} hint={form.schedule.frequency === "hourly" ? "Uses the minutes" : "Server local time"}>
              <Input type="time" value={form.schedule.time} onChange={(e) => set("schedule", { time: e.target.value })} required />
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <Switch
          checked={form.safety}
          onChange={(safety) => set("safety", safety)}
          label="Safety backups"
          description="Snapshot before restore, data reset or switching databases"
        />
        <Field label="Keep last" error={errors.retention} hint="Auto & scheduled backups beyond this are deleted. Manual ones are kept.">
          <Input type="number" min={1} max={500} value={form.retention} onChange={(e) => set("retention", Number(e.target.value))} className="block max-w-32" />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!dirty}>Save settings</Button>
        {dirty && <Button type="button" variant="ghost" onClick={() => setForm(editable(policy))}>Discard</Button>}
      </div>
    </form>
  );
}
