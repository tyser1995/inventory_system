"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/misc";
import type { Permission } from "@/lib/auth/permissions";
import { api, ApiError, useApi } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

export interface AuthMe {
  user: PublicUser;
  role: { id: string; name: string };
  permissions: Permission[];
  isSuperadmin: boolean;
}

interface AuthValue extends AuthMe {
  can: (...perms: Permission[]) => boolean;
  canAny: (...perms: Permission[]) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Loads the signed-in user; redirects to /login when there's no valid session. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, error, mutate } = useApi<AuthMe>("/api/auth/me", { shouldRetryOnError: false, keepPreviousData: false });
  const unauthenticated = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthenticated, router, pathname]);

  const can = useCallback((...perms: Permission[]) => !!data && perms.every((p) => data.permissions.includes(p)), [data]);
  const canAny = useCallback((...perms: Permission[]) => !!data && perms.some((p) => data.permissions.includes(p)), [data]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload resets all client state for the new session
    window.location.assign("/login");
  }, []);

  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {error && !unauthenticated ? (
          <p className="text-sm text-danger">Couldn&apos;t load your session: {(error as Error).message}</p>
        ) : (
          <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading" />
        )}
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...data, can, canAny, logout, refresh: mutate }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Renders children only if the user has every listed permission (or any of them with `any`);
 * otherwise a friendly no-access state.
 */
export function RequirePermission({ perm, any, children }: { perm: Permission | Permission[]; any?: boolean; children: React.ReactNode }) {
  const { can, canAny } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (any ? canAny(...perms) : can(...perms)) return <>{children}</>;
  return (
    <Card>
      <EmptyState icon={ShieldX} title="You don't have access to this page" description="Ask an administrator to update your role if you need it." />
    </Card>
  );
}
