import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authFromRequest } from "@/lib/auth/guard";
import { RateLimitError } from "@/lib/errors";
import { clientIp } from "@/lib/logs/audit";
import { logError } from "@/lib/logs/errors";

const schema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  digest: z.string().max(100).optional(),
  kind: z.enum(["error", "unhandledrejection", "boundary"]).optional(),
});

// Browser error reports are accepted without a session (e.g. login page) but rate limited per IP.
const LIMIT = 30;
const g = globalThis as typeof globalThis & { __clientErrRate?: Map<string, { n: number; t: number }> };
const rate = (g.__clientErrRate ??= new Map());

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  const r = rate.get(ip);
  const now = Date.now();
  if (r && now - r.t < 60_000) {
    if (++r.n > LIMIT) throw new RateLimitError("Too many error reports");
  } else rate.set(ip, { n: 1, t: now });

  const body = await parseBody(req, schema);
  const auth = await authFromRequest(req);
  await logError({
    source: "client", message: body.message, stack: body.stack, url: body.url, digest: body.digest,
    userId: auth?.user.id, userName: auth?.user.name, userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return { ok: true };
});
