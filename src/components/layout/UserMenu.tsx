"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Shield, UserCog } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-primary-fg", className)}>
      {initials(name)}
    </span>
  );
}

export function UserMenu() {
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="ring-focus flex cursor-pointer items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-surface-2 sm:pr-2"
      >
        <Avatar name={user.name} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-32 truncate text-sm font-semibold">{user.name}</span>
          <span className="block text-[11px] text-muted">{role.name}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted md:block" />
      </button>
      {open && (
        <div className="animate-pop absolute top-12 right-0 z-50 w-64 overflow-hidden rounded-[var(--radius)] border border-border bg-surface-solid shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Avatar name={user.name} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Shield className="size-3" /> {role.name}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            <Link href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
              <UserCog className="size-4 text-muted" /> My account
            </Link>
            <button onClick={logout} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
