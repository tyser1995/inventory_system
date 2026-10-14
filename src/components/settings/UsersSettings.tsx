"use client";

import { useMemo, useState } from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Search, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordInput";
import { Avatar } from "@/components/layout/UserMenu";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { SUPERADMIN_ROLE_ID, type Permission } from "@/lib/auth/permissions";
import { api, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import { fmtRelative } from "@/lib/format";
import type { PublicUser } from "@/lib/types";

type Row = PublicUser & { roleName: string };
type RoleRow = { id: string; name: string; permissions: Permission[]; system: boolean };

export const roleTone = (id: string): Tone => (id === SUPERADMIN_ROLE_ID ? "accent" : id === "admin" ? "primary" : id === "staff" ? "neutral" : "success");

export function UsersSettings() {
  const { user: me, permissions, isSuperadmin } = useAuth();
  const toast = useToast();
  const { data: users, isLoading } = useApi<Row[]>("/api/users");
  const { data: roles } = useApi<RoleRow[]>("/api/roles");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ open: boolean; user?: Row | null }>({ open: false });
  const [resetting, setResetting] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  // Mirrors the server rule: you can only manage roles whose access you fully hold.
  const manageable = (roleId: string) => {
    if (isSuperadmin) return true;
    const role = roles?.find((r) => r.id === roleId);
    return !!role && role.id !== SUPERADMIN_ROLE_ID && role.permissions.every((p) => permissions.includes(p));
  };
  const assignable = (roles ?? []).filter((r) => manageable(r.id));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || `${u.name} ${u.email} ${u.roleName}`.toLowerCase().includes(q));
  }, [users, query]);

  async function toggleActive(u: Row) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", json: { active: !u.active } });
      await refreshAll();
      toast(u.active ? `${u.name} deactivated` : `${u.name} reactivated`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted">{users ? `${users.length} account${users.length === 1 ? "" : "s"}` : "Loading…"} · people who can sign in</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" className="pl-9" />
          </div>
          <Button onClick={() => setEditing({ open: true, user: null })}><Plus className="size-4" /> <span className="hidden sm:inline">Add user</span></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-5 pb-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((u) => {
            const self = u.id === me.id;
            const canManage = manageable(u.roleId);
            return (
              <li key={u.id} className={cn("flex items-center gap-3 px-5 py-3.5", !u.active && "opacity-60")}>
                <Avatar name={u.name} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{u.name}</span>
                    {self && <Badge>You</Badge>}
                    {!u.active && <Badge tone="danger">Deactivated</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <div className="hidden w-32 text-xs text-muted md:block">
                  {u.lastLoginAt ? <>Last seen {fmtRelative(u.lastLoginAt)}</> : "Never signed in"}
                </div>
                <Badge tone={roleTone(u.roleId)} className="hidden sm:inline-flex">{u.roleName}</Badge>
                {canManage ? (
                  <UserActions
                    self={self}
                    active={u.active}
                    onEdit={() => setEditing({ open: true, user: u })}
                    onReset={() => setResetting(u)}
                    onToggle={() => toggleActive(u)}
                    onDelete={() => setDeleting(u)}
                  />
                ) : (
                  <span className="w-8" title="Higher access than yours" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <UserForm open={editing.open} user={editing.user} roles={assignable} self={editing.user?.id === me.id} onClose={() => setEditing({ open: false })} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete user?"
        message={<><b className="text-text">{deleting?.name}</b> will lose access immediately. Their past stock movements stay in the ledger.</>}
        onConfirm={async () => {
          try {
            await api(`/api/users/${deleting!.id}`, { method: "DELETE" });
            await refreshAll();
            toast("User deleted");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}

function UserActions({ self, active, onEdit, onReset, onToggle, onDelete }: {
  self: boolean; active: boolean; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "Edit", icon: Pencil, fn: onEdit, show: true },
    { label: "Reset password", icon: KeyRound, fn: onReset, show: !self },
    { label: active ? "Deactivate" : "Reactivate", icon: active ? UserX : UserCheck, fn: onToggle, show: !self },
    { label: "Delete", icon: Trash2, fn: onDelete, show: !self, danger: true },
  ].filter((i) => i.show);
  return (
    <div className="relative">
      <Button size="icon" variant="ghost" className="size-8" onClick={() => setOpen((o) => !o)} aria-label="User actions" aria-expanded={open}>
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute top-9 right-0 z-20 w-48 rounded-xl border border-border bg-surface-solid p-1 shadow-xl">
            {items.map(({ label, icon: Icon, fn, danger }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); fn(); }}
                className={cn("flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2", danger && "text-danger")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserForm({ open, user, roles, self, onClose }: { open: boolean; user?: Row | null; roles: RoleRow[]; self: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={user ? "Edit user" : "Add user"} description={user ? user.email : "They'll sign in with this email and password"}>
      {open && <UserFormBody key={user?.id ?? "new"} user={user} roles={roles} self={self} onDone={onClose} />}
    </Modal>
  );
}

function UserFormBody({ user, roles, self, onDone }: { user?: Row | null; roles: RoleRow[]; self: boolean; onDone: () => void }) {
  const [form, setForm] = useState({
    name: user?.name ?? "", email: user?.email ?? "", roleId: user?.roleId ?? roles.find((r) => r.id === "staff")?.id ?? roles[0]?.id ?? "",
    password: "", active: user?.active ?? true,
  });
  const { busy, errors, submit } = useFormSubmit();
  // Keep the user's current role selectable even if the editor can't assign it (it's then read-only).
  const roleLocked = self || (user && !roles.some((r) => r.id === user.roleId));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = user
      ? await submit(
          () => api(`/api/users/${user.id}`, {
            method: "PATCH",
            json: { name: form.name, email: form.email, ...(roleLocked ? {} : { roleId: form.roleId }), ...(self ? {} : { active: form.active }) },
          }),
          "User updated",
        )
      : await submit(() => api("/api/users", { method: "POST", json: form }), `${form.name} can now sign in`);
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus required />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" required />
        </Field>
      </div>
      <Field label="Role" error={errors.roleId} hint={self ? "You can't change your own role" : roleLocked ? "This user's role is above your access level" : undefined}>
        <Select value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))} disabled={!!roleLocked} required>
          {roleLocked && user && <option value={user.roleId}>{user.roleName}</option>}
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
      {!user && (
        <>
          <Field label="Temporary password" error={errors.password} hint="Share it securely; they can change it under My account">
            <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" minLength={8} required />
          </Field>
          <StrengthMeter password={form.password} />
        </>
      )}
      {!self && (
        <div className="rounded-xl border border-border p-4">
          <Switch checked={form.active} onChange={(active) => setForm((f) => ({ ...f, active }))} label="Active" description="Inactive users can't sign in" />
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{user ? "Save changes" : "Create user"}</Button>
      </div>
    </form>
  );
}

function ResetPasswordModal({ user, onClose }: { user: Row | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, errors, submit } = useFormSubmit();
  return (
    <Modal open={!!user} onClose={() => { setPassword(""); onClose(); }} title="Reset password" description={user ? `Set a new password for ${user.name}. They'll be signed out everywhere.` : ""} size="sm">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await submit(() => api(`/api/users/${user!.id}/password`, { method: "POST", json: { password } }), "Password reset");
          if (ok) { setPassword(""); onClose(); }
        }}
      >
        <Field label="New password" error={errors.password}>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
        </Field>
        <StrengthMeter password={password} />
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Reset password</Button>
        </div>
      </form>
    </Modal>
  );
}
