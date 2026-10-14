"use client";

import { useState } from "react";
import { Check, Crown, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, SUPERADMIN_ROLE_ID, type Permission } from "@/lib/auth/permissions";
import { api, refreshAll, useApi } from "@/lib/client";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";
import { roleTone } from "./UsersSettings";

type RoleRow = Role & { userCount: number };

export function RolesSettings() {
  const { data: roles, isLoading } = useApi<RoleRow[]>("/api/roles");
  const { permissions: mine, isSuperadmin } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<{ open: boolean; role?: RoleRow | null }>({ open: false });
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

  const canEdit = (r: RoleRow) => r.id !== SUPERADMIN_ROLE_ID && (isSuperadmin || r.permissions.every((p) => mine.includes(p)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold tracking-tight">Roles &amp; permissions</h2>
          <p className="text-sm text-muted">Roles bundle permissions. Assign them to users under the Users tab.</p>
        </div>
        <Button onClick={() => setEditing({ open: true, role: null })}><Plus className="size-4" /> New role</Button>
      </div>

      {isLoading || !roles ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => {
            const superadmin = r.id === SUPERADMIN_ROLE_ID;
            const editable = canEdit(r);
            return (
              <Card key={r.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", superadmin ? "bg-accent/15 text-[color-mix(in_oklab,var(--accent)_65%,var(--text))]" : "bg-primary/10 text-primary")}>
                    {superadmin ? <Crown className="size-5" /> : <ShieldCheck className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {r.name}
                      {r.system && <Badge tone={roleTone(r.id)}>Built-in</Badge>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.description || "No description"}</p>
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>{superadmin ? "All permissions" : `${r.permissions.length} of ${ALL_PERMISSIONS.length} permissions`}</span>
                    <span className="flex items-center gap-1"><Users className="size-3" /> {r.userCount}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(r.permissions.length / ALL_PERMISSIONS.length) * 100}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {PERMISSION_GROUPS.map((g) => {
                      const n = g.items.filter((i) => r.permissions.includes(i.key)).length;
                      return n ? <Badge key={g.group}>{g.group} {n}/{g.items.length}</Badge> : null;
                    })}
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  {editable ? (
                    <>
                      <Button size="sm" variant="outline" className="flex-1 justify-center" onClick={() => setEditing({ open: true, role: r })}>
                        <Pencil className="size-3.5" /> Edit permissions
                      </Button>
                      {!r.system && (
                        <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> {superadmin ? "Always has full access" : "Above your access level"}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RoleForm open={editing.open} role={editing.role} grantable={isSuperadmin ? ALL_PERMISSIONS : mine} onClose={() => setEditing({ open: false })} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete role?"
        message={<>The <b className="text-text">{deleting?.name}</b> role will be removed. Roles still assigned to users can&apos;t be deleted.</>}
        onConfirm={async () => {
          try {
            await api(`/api/roles/${deleting!.id}`, { method: "DELETE" });
            await refreshAll();
            toast("Role deleted");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function RoleForm({ open, role, grantable, onClose }: { open: boolean; role?: RoleRow | null; grantable: Permission[]; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={role ? `Edit ${role.name}` : "New role"} description="Choose exactly what this role can do" size="lg">
      {open && <RoleFormBody key={role?.id ?? "new"} role={role} grantable={grantable} onDone={onClose} />}
    </Modal>
  );
}

function RoleFormBody({ role, grantable, onDone }: { role?: RoleRow | null; grantable: Permission[]; onDone: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? ["dashboard.view", "products.view"]));
  const { busy, errors, submit } = useFormSubmit();

  const toggle = (p: Permission) => setPerms((s) => {
    const next = new Set(s);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    return next;
  });
  const setGroup = (keys: Permission[], on: boolean) => setPerms((s) => {
    const next = new Set(s);
    for (const k of keys) {
      if (!grantable.includes(k)) continue;
      if (on) next.add(k);
      else next.delete(k);
    }
    return next;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const json = { name, description, permissions: [...perms] };
    const ok = role
      ? await submit(() => api(`/api/roles/${role.id}`, { method: "PUT", json }), "Role updated")
      : await submit(() => api("/api/roles", { method: "POST", json }), "Role created");
    if (ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role name" error={errors.name} hint={role?.system ? "Built-in roles can't be renamed" : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manager" disabled={role?.system} autoFocus required />
        </Field>
        <Field label="Description" error={errors.description}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-10" placeholder="What is this role for?" />
        </Field>
      </div>

      {errors.permissions && <p className="text-xs text-danger">{errors.permissions}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {PERMISSION_GROUPS.map((g) => {
          const keys = g.items.map((i) => i.key as Permission);
          const allOn = keys.filter((k) => grantable.includes(k)).every((k) => perms.has(k));
          return (
            <div key={g.group} className="rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className="text-xs font-semibold tracking-wide text-muted uppercase">{g.group}</span>
                <button type="button" onClick={() => setGroup(keys, !allOn)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                  {allOn ? "Clear" : "All"}
                </button>
              </div>
              <ul className="p-1.5">
                {g.items.map((item) => {
                  const key = item.key as Permission;
                  const on = perms.has(key);
                  const locked = !grantable.includes(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={locked}
                        onClick={() => toggle(key)}
                        title={locked ? "You can't grant a permission you don't have" : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-fg" : "border-muted/50")}>
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        {item.label}
                        {locked && <Lock className="ml-auto size-3 text-muted" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <span className="text-xs text-muted">{perms.size} permission{perms.size === 1 ? "" : "s"} selected</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button type="submit" loading={busy}>{role ? "Save role" : "Create role"}</Button>
        </div>
      </div>
    </form>
  );
}
