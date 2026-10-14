"use client";

import { useMemo, useState } from "react";
import {
  AlertOctagon, AlertTriangle, Bug, Check, CheckCircle2, Cloud, Copy, EyeOff, Globe, RotateCcw, Search, Server, Timer, Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtNumber, fmtRelative } from "@/lib/format";
import type { ErrorEntry, ErrorGroup, ErrorSource, ErrorStatus } from "@/lib/logs/types";

interface ErrorsResponse {
  groups: ErrorGroup[];
  stats: { open: number; resolved: number; ignored: number; last24h: number; occurrences: number };
}

const SOURCE: Record<ErrorSource, { label: string; icon: LucideIcon }> = {
  server: { label: "Server", icon: Server },
  client: { label: "Browser", icon: Globe },
  background: { label: "Background job", icon: Timer },
  upstream: { label: "Supabase / external", icon: Cloud },
};
const STATUS: Record<ErrorStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "danger" },
  resolved: { label: "Resolved", tone: "success" },
  ignored: { label: "Ignored", tone: "neutral" },
};

export function ErrorLog() {
  const { can } = useAuth();
  const manage = can("logs.manage");
  const toast = useToast();
  const [days, setDays] = useState("30");
  const [status, setStatus] = useState<ErrorStatus | "all">("open");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ErrorGroup | null>(null);
  const { data, isLoading } = useApi<ErrorsResponse>(`/api/logs/errors?days=${days}`, { refreshInterval: 30_000 });

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.groups ?? []).filter(
      (g) =>
        (status === "all" || g.status === status) &&
        (!source || g.source === source) &&
        (!term || `${g.message} ${g.path ?? ""} ${g.name ?? ""}`.toLowerCase().includes(term)),
    );
  }, [data, status, source, q]);

  const allSelected = groups.length > 0 && groups.every((g) => selected.has(g.fingerprint));

  async function bulk(next: ErrorStatus) {
    try {
      await api("/api/logs/errors", { method: "PATCH", json: { fingerprints: [...selected], status: next } });
      setSelected(new Set());
      await refreshAll();
      toast(`${selected.size} error${selected.size === 1 ? "" : "s"} marked ${STATUS[next].label.toLowerCase()}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={AlertOctagon} label="Open issues" value={data?.stats.open} tone={data?.stats.open ? "danger" : undefined} />
        <Tile icon={Timer} label="Active last 24h" value={data?.stats.last24h} />
        <Tile icon={Bug} label="Occurrences" value={data?.stats.occurrences} />
        <Tile icon={CheckCircle2} label="Resolved" value={data?.stats.resolved} tone="success" />
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
            {(["open", "resolved", "ignored", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setSelected(new Set()); }}
                className={cn(
                  "ring-focus shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                  status === s ? "bg-surface-solid text-text shadow-sm" : "text-muted hover:text-text",
                )}
              >
                {s === "all" ? "All" : STATUS[s].label}
                {s !== "all" && data && <span className="ml-1 opacity-60">{data.stats[s]}</span>}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search message or location" className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source" className="lg:w-44">
              <option value="">All sources</option>
              {(Object.keys(SOURCE) as ErrorSource[]).map((s) => <option key={s} value={s}>{SOURCE[s].label}</option>)}
            </Select>
            <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period" className="lg:w-36">
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          </div>
        </div>
      </Card>

      {manage && selected.size > 0 && (
        <Card className="animate-pop flex flex-wrap items-center gap-2 border-primary/30 bg-primary/5 p-3">
          <span className="mr-auto text-sm font-semibold">{selected.size} selected</span>
          <Button size="sm" onClick={() => bulk("resolved")}><Check className="size-3.5" /> Resolve</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("ignored")}><EyeOff className="size-3.5" /> Ignore</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("open")}><RotateCcw className="size-3.5" /> Reopen</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        {isLoading && !data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={status === "open" ? CheckCircle2 : Bug}
            title={status === "open" ? "No open errors" : "No errors found"}
            description={status === "open" ? "Everything is running smoothly." : "Try another filter or a longer period."}
          />
        ) : (
          <>
            {manage && (
              <label className="flex cursor-pointer items-center gap-3 border-b border-border px-5 py-2.5 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(groups.map((g) => g.fingerprint)))}
                  className="size-4 cursor-pointer accent-[var(--primary)]"
                />
                Select all ({groups.length})
              </label>
            )}
            <ul className="divide-y divide-border">
              {groups.map((g) => {
                const src = SOURCE[g.source];
                return (
                  <li key={g.fingerprint} className="flex items-start gap-3 px-5 py-3.5 hover:bg-primary/[0.03]">
                    {manage && (
                      <input
                        type="checkbox"
                        checked={selected.has(g.fingerprint)}
                        onChange={() => setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(g.fingerprint)) n.delete(g.fingerprint);
                          else n.add(g.fingerprint);
                          return n;
                        })}
                        className="mt-3 size-4 cursor-pointer accent-[var(--primary)]"
                        aria-label="Select error"
                      />
                    )}
                    <button onClick={() => setDetail(g)} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", g.level === "warning" ? "bg-warning/12 text-warning" : "bg-danger/10 text-danger")}>
                        {g.level === "warning" ? <AlertTriangle className="size-4" /> : <AlertOctagon className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold break-words">{g.message}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><src.icon className="size-3" /> {src.label}</span>
                          {g.path && <span className="max-w-64 truncate font-mono">{g.path}</span>}
                          <span>Last {fmtRelative(g.lastSeen)}</span>
                          {g.users > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3" /> {g.users}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>
                        <span className="text-xs font-semibold tabular-nums text-muted">×{fmtNumber(g.count)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <ErrorDetail group={detail} manage={manage} onClose={() => setDetail(null)} />
    </div>
  );
}

function ErrorDetail({ group, manage, onClose }: { group: ErrorGroup | null; manage: boolean; onClose: () => void }) {
  return (
    <Modal open={!!group} onClose={onClose} title="Error details" description={group ? `${SOURCE[group.source].label} · seen ${fmtNumber(group.count)}×` : ""} size="lg">
      {group && <ErrorDetailBody key={group.fingerprint} group={group} manage={manage} onDone={onClose} />}
    </Modal>
  );
}

function ErrorDetailBody({ group, manage, onDone }: { group: ErrorGroup; manage: boolean; onDone: () => void }) {
  const toast = useToast();
  const { data } = useApi<{ status: ErrorStatus; note?: string; updatedBy?: string; updatedAt?: string; occurrences: ErrorEntry[]; total: number }>(
    `/api/logs/errors/${group.fingerprint}`,
  );
  const [note, setNote] = useState(group.note ?? "");
  const [busy, setBusy] = useState<ErrorStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const latest = data?.occurrences[0];

  async function update(status: ErrorStatus) {
    setBusy(status);
    try {
      await api("/api/logs/errors", { method: "PATCH", json: { fingerprints: [group.fingerprint], status, note: note || undefined } });
      await refreshAll();
      toast(`Marked ${STATUS[status].label.toLowerCase()}`);
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-danger/8 p-4">
        {group.name && <p className="font-mono text-xs font-semibold text-danger">{group.name}</p>}
        <p className="mt-1 text-sm font-semibold break-words">{group.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={STATUS[group.status].tone}>{STATUS[group.status].label}</Badge>
          <Badge>{SOURCE[group.source].label}</Badge>
          {group.path && <Badge className="font-mono">{group.path}</Badge>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Occurrences" value={fmtNumber(group.count)} />
        <Stat label="Users affected" value={fmtNumber(group.users)} />
        <Stat label="First seen" value={fmtRelative(group.firstSeen)} title={new Date(group.firstSeen).toLocaleString()} />
        <Stat label="Last seen" value={fmtRelative(group.lastSeen)} title={new Date(group.lastSeen).toLocaleString()} />
      </dl>

      {latest?.stack && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">Stack trace (latest)</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(`${latest.message}\n${latest.stack}`).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="max-h-56 overflow-auto rounded-xl bg-surface-2/70 p-3 font-mono text-[11px] leading-relaxed text-muted">{latest.stack}</pre>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Recent occurrences {data && `(${Math.min(data.occurrences.length, 50)} of ${data.total})`}</p>
        {!data ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-auto rounded-xl border border-border text-xs">
            {data.occurrences.map((o) => (
              <li key={o.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[150px_120px_1fr]">
                <span className="text-muted" title={o.ts}>{new Date(o.ts).toLocaleString()}</span>
                <span className="truncate font-medium">{o.userName ?? "Anonymous"}</span>
                <span className="truncate font-mono text-muted">{[o.method, o.path ?? o.url].filter(Boolean).join(" ") || o.userAgent || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {manage ? (
        <div className="space-y-3 border-t border-border pt-4">
          <Field label="Resolution note" hint={data?.updatedBy ? `Last updated by ${data.updatedBy} ${data.updatedAt ? fmtRelative(data.updatedAt) : ""}` : undefined}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What caused it / what was done" maxLength={500} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            {group.status !== "open" && <Button variant="outline" loading={busy === "open"} onClick={() => update("open")}><RotateCcw className="size-4" /> Reopen</Button>}
            {group.status !== "ignored" && <Button variant="outline" loading={busy === "ignored"} onClick={() => update("ignored")}><EyeOff className="size-4" /> Ignore</Button>}
            {group.status !== "resolved" && <Button loading={busy === "resolved"} onClick={() => update("resolved")}><Check className="size-4" /> Mark resolved</Button>}
          </div>
        </div>
      ) : (
        group.note && <p className="rounded-xl bg-surface-2/70 p-3 text-sm"><b>Note:</b> {group.note}</p>
      )}
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-xl border border-border p-3" title={title}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value?: number; tone?: "danger" | "success" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Icon className={cn("size-3.5", tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-primary")} /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value === undefined ? "—" : fmtNumber(value)}</p>
    </Card>
  );
}
