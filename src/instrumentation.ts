import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("./lib/backup/scheduler");
    startBackupScheduler();
  }
}

/** Errors Next.js captures outside our API wrapper (e.g. while rendering pages) go to the error log. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/logs/errors");
  const e = err as Error & { digest?: string };
  await logError({
    error: e,
    source: "server",
    method: request.method,
    path: `${request.path} (${context.routeType} ${context.routePath})`,
    digest: e.digest,
    userAgent: (request.headers["user-agent"] as string | undefined) ?? undefined,
  });
};
