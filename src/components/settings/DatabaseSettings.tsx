"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft, Check, CheckCircle2, ChevronDown, Cloud, Copy, Eye, EyeOff, HardDrive, KeyRound, Loader2, PlugZap, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api, ApiError, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";

type Provider = "local" | "supabase";

interface DbInfo {
  provider: Provider;
  supabase: { url: string; keyHint: string; configured: boolean; fromEnv: boolean };
  counts: Record<string, number> | null;
  error: string | null;
  schemaSql: string;
}

const PROVIDERS: Record<Provider, { name: string; icon: typeof HardDrive; blurb: string }> = {
  local: { name: "Local database", icon: HardDrive, blurb: "JSON file on this machine (data/db.json). Zero setup, single server." },
  supabase: { name: "Supabase", icon: Cloud, blurb: "Hosted Postgres. Access your data from anywhere and query it with SQL." },
};

export function DatabaseSettings() {
  const { data, isLoading, mutate } = useApi<DbInfo>("/api/settings/database");
  const [switchTo, setSwitchTo] = useState<Provider | null>(null);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Active database" subtitle="Where products, stock and settings are stored" />
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
            const info = PROVIDERS[p];
            const active = data.provider === p;
            const canSwitch = !active && (p === "local" || data.supabase.configured);
            return (
              <div
                key={p}
                className={cn(
                  "relative flex flex-col rounded-xl border-2 p-4 transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>
                    <info.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {info.name}
                      {active && <Badge tone="success"><CheckCircle2 className="size-3" /> Active</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{info.blurb}</p>
                  </div>
                </div>
                {active && data.counts && (
                  <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                    {Object.entries(data.counts).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <p className="text-sm font-bold tabular-nums">{v}</p>
                        <p className="truncate text-[11px] text-muted capitalize">{k}</p>
                      </div>
                    ))}
                  </div>
                )}
                {active && data.error && <p className="mt-3 text-xs text-danger">{data.error}</p>}
                {!active && (
                  <div className="mt-4 flex flex-1 items-end">
                    <Button variant="outline" size="sm" disabled={!canSwitch} onClick={() => setSwitchTo(p)}>
                      <ArrowRightLeft className="size-3.5" /> Switch to {info.name}
                    </Button>
                    {!canSwitch && <span className="ml-3 text-xs text-muted">Connect Supabase below first</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <SupabaseConnection info={data} onSaved={() => mutate()} />

      <SwitchDialog target={switchTo} current={data.provider} onClose={() => setSwitchTo(null)} />
    </div>
  );
}

function SupabaseConnection({ info, onSaved }: { info: DbInfo; onSaved: () => void }) {
  const toast = useToast();
  const { busy, errors, setErrors, submit } = useFormSubmit();
  const [url, setUrl] = useState(info.supabase.url);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; counts?: Record<string, number> } | null>(null);
  const [sqlOpen, setSqlOpen] = useState(!info.supabase.configured);
  const [copied, setCopied] = useState(false);
  const locked = info.supabase.fromEnv;

  async function test() {
    setTesting(true);
    setResult(null);
    setErrors({});
    try {
      const r = await api<{ counts: Record<string, number> }>("/api/settings/database/test", {
        method: "POST",
        json: { url, serviceKey: key || undefined },
      });
      setResult({ ok: true, message: "Connected — all tables found", counts: r.counts });
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await submit(
      () => api("/api/settings/database/supabase", { method: "PUT", json: { url, serviceKey: key || undefined } }),
      "Supabase credentials saved",
    );
    if (ok) {
      setKey("");
      onSaved();
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(info.schemaSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy — select the SQL manually", "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Supabase connection"
        subtitle="Three steps: create a project, run the schema, paste your credentials"
        action={info.supabase.configured ? <Badge tone="success"><PlugZap className="size-3" /> Configured</Badge> : <Badge>Not connected</Badge>}
      />
      <div className="space-y-5 p-5">
        {/* Step 1–2: schema */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setSqlOpen((o) => !o)}
            className="ring-focus flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl p-4 text-left"
            aria-expanded={sqlOpen}
          >
            <span>
              <span className="block text-sm font-semibold">1 · Create the tables</span>
              <span className="block text-xs text-muted">In Supabase open <b>SQL Editor → New query</b>, paste this and click Run.</span>
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", sqlOpen && "rotate-180")} />
          </button>
          {sqlOpen && (
            <div className="relative border-t border-border">
              <Button type="button" size="sm" variant="outline" onClick={copySql} className="absolute top-3 right-3 z-10">
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy SQL"}
              </Button>
              <pre className="max-h-72 overflow-auto bg-surface-2/60 p-4 pr-28 font-mono text-[11px] leading-relaxed text-muted">{info.schemaSql}</pre>
            </div>
          )}
        </div>

        {/* Step 3: credentials */}
        <form onSubmit={save} className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold">2 · Connect</p>
            <p className="text-xs text-muted">Find these in Supabase under <b>Project Settings → API</b>.</p>
          </div>
          {locked && (
            <p className="rounded-lg bg-primary/8 p-3 text-xs text-primary">
              Credentials come from the <code className="font-mono">SUPABASE_URL</code> / <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> environment variables and can&apos;t be changed here.
            </p>
          )}
          <Field label="Project URL" error={errors.url}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" disabled={locked} inputMode="url" />
          </Field>
          <Field
            label="service_role key"
            error={errors.serviceKey}
            hint={info.supabase.keyHint ? `Saved key ${info.supabase.keyHint} — leave blank to keep it` : "Kept on the server only, never sent back to the browser"}
          >
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={info.supabase.keyHint || "eyJhbGciOi…"}
                className="pr-10 pl-9 font-mono"
                autoComplete="off"
                disabled={locked}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="ring-focus absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted hover:text-text"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {result && (
            <div className={cn("rounded-lg p-3 text-sm", result.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
              <p className="flex items-center gap-2 font-semibold">
                {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {result.message}
              </p>
              {result.counts && (
                <p className="mt-1 text-xs opacity-90">
                  {Object.entries(result.counts).map(([t, n]) => `${t}: ${n}`).join(" · ")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={test} disabled={!url || testing || (!key && !info.supabase.keyHint)}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Test connection
            </Button>
            {!locked && <Button type="submit" loading={busy} disabled={!url || (!key && url === info.supabase.url)}>Save credentials</Button>}
          </div>
          <p className="text-xs text-muted">
            The service_role key bypasses row-level security, so it&apos;s stored only in <code className="font-mono">data/config.json</code> on this server (git-ignored). For production, prefer environment variables.
          </p>
        </form>
      </div>
    </Card>
  );
}

function SwitchDialog({ target, current, onClose }: { target: Provider | null; current: Provider; onClose: () => void }) {
  const [mode, setMode] = useState<"migrate" | "existing">("migrate");
  const { busy, submit } = useFormSubmit();
  const router = useRouter();
  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const from = PROVIDERS[current].name;
  const to = PROVIDERS[target].name;
  const options = [
    { value: "migrate" as const, title: `Copy my current data to ${to}`, body: `Everything in ${from} is copied over. Existing data in ${to} is replaced.` },
    { value: "existing" as const, title: `Use the data already in ${to}`, body: `Nothing is copied. The app starts showing whatever ${to} contains.` },
  ];

  async function confirm() {
    const ok = await submit(() => api("/api/settings/database/switch", { method: "POST", json: { provider: target, mode } }), `Now using ${to}`);
    if (ok) {
      await refreshAll();
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Switch to ${to}?`}
      description="A safety backup of your current data is taken first (if enabled)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} loading={busy}><ArrowRightLeft className="size-4" /> Switch database</Button>
        </>
      }
    >
      <div className="space-y-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            onClick={() => setMode(o.value)}
            className={cn(
              "ring-focus flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              mode === o.value ? "border-primary bg-primary/5" : "border-border hover:border-muted/40",
            )}
          >
            <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2", mode === o.value ? "border-primary" : "border-muted/50")}>
              {mode === o.value && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{o.body}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
