import "server-only";
import { ZodError, type ZodType } from "zod";
import { authFromRequest } from "./auth/guard";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError, UpstreamError } from "./errors";
import { recordRequest } from "./logs/audit";
import { logError } from "./logs/errors";

export type IdContext = { params: Promise<{ id: string }> };

function toResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return Response.json({ error: "Please fix the highlighted fields", fieldErrors }, { status: 422 });
  }
  if (err instanceof UnauthorizedError) return Response.json({ error: err.message || "Please sign in" }, { status: 401 });
  if (err instanceof ForbiddenError) return Response.json({ error: err.message || "You don't have permission to do that" }, { status: 403 });
  if (err instanceof RateLimitError) return Response.json({ error: err.message }, { status: 429 });
  if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
  if (err instanceof ConflictError) return Response.json({ error: err.message }, { status: 409 });
  if (err instanceof BadRequestError) return Response.json({ error: err.message }, { status: 400 });
  if (err instanceof UpstreamError) return Response.json({ error: err.message }, { status: 502 });
  if (err instanceof SyntaxError) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  return Response.json({ error: "Something went wrong on our side. It has been logged." }, { status: 500 });
}

/** Top-level JSON field names of the request body (values are never logged). */
async function bodyKeys(req: Request) {
  if (req.method === "GET" || !req.headers.get("content-type")?.includes("application/json")) return undefined;
  try {
    const body = await req.clone().json();
    return body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wraps a route handler with uniform JSON responses, error mapping,
 * activity logging and error logging.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    const req = args[0] instanceof Request ? args[0] : null;
    const started = performance.now();
    const keys = req ? await bodyKeys(req) : undefined;
    let res: Response;
    let result: unknown;
    let failure: unknown;
    try {
      result = await fn(...args);
      res = result instanceof Response ? result : result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
    } catch (err) {
      failure = err;
      res = toResponse(err);
    }

    if (req) {
      // Logged after the response is built; logging failures never affect the response.
      const durationMs = performance.now() - started;
      void (async () => {
        const auth = await authFromRequest(req).catch(() => null);
        const path = new URL(req.url).pathname;
        if (res.status >= 500) {
          await logError({
            error: failure, source: failure instanceof UpstreamError ? "upstream" : "server",
            level: failure instanceof UpstreamError ? "warning" : "error",
            method: req.method, path, userId: auth?.user.id, userName: auth?.user.name, userAgent: req.headers.get("user-agent") ?? undefined,
          });
        }
        await recordRequest({
          req, status: res.status, result, durationMs, bodyKeys: keys, auth,
          // Messages of 5xx errors may contain internals; only expected (4xx) and upstream messages are kept.
          errorMessage: failure instanceof Error && (res.status < 500 || failure instanceof UpstreamError) ? failure.message : undefined,
        });
      })();
    }
    return res;
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await req.json());
}

/**
 * For partial updates (PATCH): validates the body, then keeps only the fields the client sent,
 * so schema defaults/transforms never overwrite fields that weren't part of the request.
 */
export async function parsePatch<T extends object>(req: Request, schema: ZodType<T>): Promise<Partial<T>> {
  const raw = await req.json();
  const parsed = schema.parse(raw);
  if (!raw || typeof raw !== "object") return parsed;
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as Partial<T>;
}
