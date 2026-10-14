"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Crown, Mail, User } from "lucide-react";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/client";

/** First-run: create the Super Admin. Only works while no users exist (enforced server-side). */
export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/status")
      .then((s) => !s.needsSetup && router.replace("/login"))
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (form.password !== form.confirm) {
      setErrors({ confirm: "Passwords don't match" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/setup", { method: "POST", json: { name: form.name, email: form.email, password: form.password } });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets all client state for the new session
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      setError(err instanceof Error ? err.message : "Setup failed");
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent/15 text-[color-mix(in_oklab,var(--accent)_65%,var(--text))]">
        <Crown className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">Create the Super Admin</h1>
      <p className="mt-1 text-sm text-muted">This first account has full access. You can invite admins and staff afterwards.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}
        <Field label="Full name" error={errors.name}>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={form.name} onChange={set("name")} className="pl-9" autoComplete="name" autoFocus required />
          </div>
        </Field>
        <Field label="Email" error={errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input type="email" value={form.email} onChange={set("email")} className="pl-9" autoComplete="username" required />
          </div>
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput value={form.password} onChange={set("password")} autoComplete="new-password" minLength={8} required />
        </Field>
        <StrengthMeter password={form.password} />
        <Field label="Confirm password" error={errors.confirm}>
          <PasswordInput value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
        </Field>
        <Button type="submit" loading={busy} className="h-11 w-full justify-center">Create account &amp; sign in</Button>
      </form>
    </>
  );
}
