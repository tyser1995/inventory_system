"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, LogIn, Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/client";

/** Only allow same-site relative redirects (prevents open-redirects via ?next=). */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ signedIn: boolean }>("/api/auth/status")
      .then((s) => {
        if (s.signedIn) router.replace(next);
      })
      .catch(() => undefined);
  }, [router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: form });
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to continue to your workspace.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}
        <Field label="Email">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@company.com"
              className="pl-9"
              autoFocus
              required
            />
          </div>
        </Field>
        <Field label="Password">
          <PasswordInput
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            required
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
            className="size-4 cursor-pointer rounded accent-[var(--primary)]"
          />
          Keep me signed in for 30 days
        </label>
        <Button type="submit" loading={busy} className="h-11 w-full justify-center">
          {!busy && <LogIn className="size-4" />} Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">Forgot your password? Ask an administrator to reset it.</p>
    </>
  );
}
