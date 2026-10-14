"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Activity, AlertOctagon, ArrowLeftRight, Boxes, ChevronDown, ChevronLeft, ChevronRight, Database, Download, Eye, KeyRound,
  Radio, ScrollText, Search, Settings, ShieldAlert, Tags, Users, type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/layout/UserMenu";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtNumber, fmtRelative } from "@/lib/format";
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntry } from "@/lib/logs/types";

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; denied: number; failed: number; activeUsers: number };
  users: { id: string; name: string }[];
}

const CATEGORY_ICON: Record<AuditCategory, LucideIcon> = {
  auth: KeyRound, navigation: Eye, inventory: Boxes, catalog: Tags, users: Users,
  settings: Settings, backup: ScrollText, database: Database, logs: ScrollText, api: ArrowLeftRight,
};

const RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

const VERBS: Record<string, string> = {
  create: "created", update: "updated", delete: "deleted", record: "recorded", restore: "restored", download: "downloaded",
  import: "imported", switch: "switched", test: "tested", reset: "reset", login: "signed in", logout: "signed out",
  login_failed: "sign-in failed", login_locked: "sign-in locked out", setup: "initial setup", view: "viewed", password_reset: "password reset",
  password_change: "password changed", credentials: "credentials saved", export: "exported", access: "access",
};

/** "product.update" → "Product updated"; "page.view" → "Viewed page". */
export function actionLabel(action: string) {
  if (action === "page.view") return "Viewed page";
  if (action === "api.access") return "API access";
  if (action.startsWith("export.")) return `Exported ${action.slice(7).replace(".", " ")}`;
  const [subject, verb] = action.split(".");
  const s = subject.replace(/_/g, " ");
  if (subject === "auth") {
    const v = VERBS[verb] ?? verb;
    return v[0].toUpperCase() + v.slice(1);
  }
  if (subject === "account") return `Account ${VERBS[verb] ?? verb}`;
  if (subject === "settings") return `Changed ${verb} settings`;
  return `${s[0].toUpperCase()}${s.slice(1)} ${VERBS[verb] ?? verb?.replace(/_/g, " ") ?? ""}`.trim();
}

const OUTCOME: Record<AuditEntry["outcome"], { label: string; tone: Tone }> = {
  success: { label: "Success", tone: "success" },
  denied: { label: "Denied", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function ActivityLog() {
  const [range, setRange] = useState("7");
  const [custom, setCustom] = useState(() => ({ from: isoDay(new Date(Date.now() - 7 * 86_400_000)), to: isoDay(new Date()) }));
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (range === "custom") {
      p.set("from", custom.from);
      p.set("to", custom.to);
    } else {
      p.set("days", range); // resolved server-side so live refresh always covers "now"
    }
    if (q.trim()) p.set("q", q.trim());
    if (user) p.set("user", user);
    if (category) p.set("category", category);
    if (outcome) p.set("outcome", outcome);
    return p;
  }, [range, custom, q, user, category, outcome]);

  const listParams = new URLSearchParams(params);
  listParams.set("page", String(page));
  const { data, isLoading } = useApi<AuditResponse>(`/api/logs/audit?${listParams}`, { refreshInterval: live ? 10_000 : 0 });

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Activity} label="Events" value={data ? fmtNumber(data.summary.total) : "—"} />
        <Tile icon={Users} label="Active users" value={data ? fmtNumber(data.summary.activeUsers) : "—"} />
        <Tile icon={ShieldAlert} label="Denied" value={data ? fmtNumber(data.summary.denied) : "—"} tone={data?.summary.denied ? "warning" : undefined} />
        <Tile icon={AlertOctagon} label="Failed" value={data ? fmtNumber(data.summary.failed) : "—"} tone={data?.summary.failed ? "danger" : undefined} />
      </div>

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_160px_140px_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Search action, user, target, IP…" className="pl-9" />
          </div>
          <Select value={range} onChange={(e) => reset(setRange)(e.target.value)} aria-label="Time range">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Select value={user} onChange={(e) => reset(setUser)(e.target.value)} aria-label="User">
            <option value="">All users</option>
            {data?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={category} onChange={(e) => reset(setCategory)(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {AUDIT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Select value={outcome} onChange={(e) => reset(setOutcome)(e.target.value)} aria-label="Outcome">
            <option value="">Any outcome</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failed">Failed</option>
          </Select>
          <div className="flex gap-2">
            <Button
              variant={live ? "primary" : "outline"}
              onClick={() => setLive((l) => !l)}
              aria-pressed={live}
              title="Refresh every 10 seconds"
              className="flex-1 justify-center"
            >
              <Radio className={cn("size-4", live && "animate-pulse")} /> Live
            </Button>
            <a href={`/api/logs/audit/export?${params}`} download className="flex-1">
              <Button variant="outline" className="w-full justify-center" tabIndex={-1}><Download className="size-4" /> CSV</Button>
            </a>
          </div>
        </div>
        {range === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Input type="date" value={custom.from} max={custom.to} onChange={(e) => reset(setCustom)({ ...custom, from: e.target.value })} className="w-auto" aria-label="From date" />
            <span className="text-muted">to</span>
            <Input type="date" value={custom.to} min={custom.from} onChange={(e) => reset(setCustom)({ ...custom, to: e.target.value })} className="w-auto" aria-label="To date" />
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {isLoading && !data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.entries.length ? (
          <EmptyState icon={ScrollText} title="No activity found" description="Try a wider time range or clear filters." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted uppercase">
                    <th className="px-5 py-3">When</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Target / details</th>
                    <th className="px-3 py-3">Outcome</th>
                    <th className="w-8 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.entries.map((e) => {
                    const Icon = CATEGORY_ICON[e.category] ?? Activity;
                    const open = expanded === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr className="cursor-pointer hover:bg-primary/[0.03]" onClick={() => setExpanded(open ? null : e.id)}>
                          <td className="px-5 py-2.5 whitespace-nowrap" title={new Date(e.ts).toLocaleString()}>
                            <p className="font-medium">{fmtRelative(e.ts)}</p>
                            <p className="text-[11px] text-muted">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            {e.userName ? (
                              <div className="flex items-center gap-2">
                                <Avatar name={e.userName} className="size-7 text-[10px]" />
                                <div className="min-w-0">
                                  <p className="max-w-36 truncate font-medium">{e.userName}</p>
                                  {e.role && <p className="text-[11px] text-muted">{e.role}</p>}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">Anonymous</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap">
                              <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted"><Icon className="size-3.5" /></span>
                              {actionLabel(e.action)}
                            </span>
                          </td>
                          <td className="max-w-80 px-3 py-2.5">
                            <p className="truncate">{e.target ?? (e.action === "api.access" ? e.path : "—")}</p>
                            {e.details && <p className="truncate text-xs text-muted">{e.details}</p>}
                          </td>
                          <td className="px-3 py-2.5"><Badge tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Badge></td>
                          <td className="px-3 py-2.5"><ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} /></td>
                        </tr>
                        {open && (
                          <tr className="bg-surface-2/40">
                            <td colSpan={6} className="px-5 py-3"><EntryDetails e={e} /></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {data.entries.map((e) => {
                const Icon = CATEGORY_ICON[e.category] ?? Activity;
                const open = expanded === e.id;
                return (
                  <li key={e.id} className="p-4" onClick={() => setExpanded(open ? null : e.id)}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><Icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{actionLabel(e.action)}</p>
                          <Badge tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Badge>
                        </div>
                        <p className="truncate text-xs text-muted">{e.userName ?? "Anonymous"} · {fmtRelative(e.ts)}</p>
                        {(e.target || e.details) && <p className="mt-1 truncate text-xs">{[e.target, e.details].filter(Boolean).join(" · ")}</p>}
                      </div>
                    </div>
                    {open && <div className="mt-3"><EntryDetails e={e} /></div>}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
              <span className="text-muted">
                {fmtNumber((data.page - 1) * data.pageSize + 1)}–{fmtNumber(Math.min(data.page * data.pageSize, data.total))} of {fmtNumber(data.total)}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="size-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
                <span className="px-2 text-xs text-muted">Page {page} / {pages}</span>
                <Button size="icon" variant="ghost" className="size-8" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function EntryDetails({ e }: { e: AuditEntry }) {
  const rows: [string, string | number | undefined][] = [
    ["Time", new Date(e.ts).toLocaleString()],
    ["Action", e.action],
    ["Target", e.target],
    ["Details", e.details],
    ["Request", e.method && e.path ? `${e.method} ${e.path}` : undefined],
    ["Status", e.status ? `${e.status}${e.durationMs !== undefined ? ` · ${e.durationMs} ms` : ""}` : undefined],
    ["IP address", e.ip],
    ["Device", e.userAgent],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[110px_1fr]">
      {rows.filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => (
        <Fragment key={k}>
          <dt className="font-semibold text-muted">{k}</dt>
          <dd className="font-mono break-all">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: "warning" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Icon className={cn("size-3.5", tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-primary")} /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}
