"use client";

import { useState } from "react";
import { Check, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordInput";
import { Avatar } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/misc";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { PERMISSION_GROUPS } from "@/lib/auth/permissions";
import { api } from "@/lib/client";
import { fmtDate } from "@/lib/format";

export function AccountView() {
  const { user, role, permissions, refresh, logout } = useAuth();
  const profile = useFormSubmit();
  const pw = useFormSubmit();
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const dirty = form.name !== user.name || form.email !== user.email;

  return (
    <>
      <PageHeader title="My account" description="Your profile, password and access" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-fit p-6 text-center">
          <Avatar name={user.name} className="mx-auto size-20 text-2xl" />
          <p className="mt-4 text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="size-3.5" /> {role.name}
          </p>
          <p className="mt-4 text-xs text-muted">Member since {fmtDate(user.createdAt)}</p>
          <Button variant="outline" className="mt-5 w-full justify-center" onClick={logout}><LogOut className="size-4" /> Sign out</Button>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" subtitle="How you appear in the stock ledger" />
            <form
              className="space-y-4 p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await profile.submit(() => api("/api/auth/me", { method: "PATCH", json: form }), "Profile updated")) await refresh();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={profile.errors.name}>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </Field>
                <Field label="Email (sign-in)" error={profile.errors.email}>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                </Field>
              </div>
              <Button type="submit" loading={profile.busy} disabled={!dirty}>Save profile</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Change password" subtitle="Signs you out on every other device" />
            <form
              className="space-y-4 p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (pwForm.newPassword !== pwForm.confirm) return setConfirmError("Passwords don't match");
                setConfirmError(null);
                const body = { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword };
                if (await pw.submit(() => api("/api/auth/password", { method: "POST", json: body }), "Password changed"))
                  setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
              }}
            >
              <Field label="Current password" error={pw.errors.currentPassword}>
                <PasswordInput value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} autoComplete="current-password" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" error={pw.errors.newPassword}>
                  <PasswordInput value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} autoComplete="new-password" minLength={8} required />
                </Field>
                <Field label="Confirm new password" error={confirmError ?? undefined}>
                  <PasswordInput value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" required />
                </Field>
              </div>
              <StrengthMeter password={pwForm.newPassword} />
              <Button type="submit" loading={pw.busy}>Update password</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Your access" subtitle={`Granted by the ${role.name} role`} />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.group}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.group}</p>
                  <ul className="space-y-1.5 text-sm">
                    {g.items.map((i) => {
                      const has = permissions.includes(i.key);
                      return (
                        <li key={i.key} className={has ? "flex items-center gap-2" : "flex items-center gap-2 text-muted/60 line-through"}>
                          <Check className={has ? "size-3.5 text-success" : "size-3.5 opacity-0"} /> {i.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
