import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { audit } from "@/lib/logs/audit";

/** Client-side events that the server can't see: page views and client-only exports. */
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), path: z.string().max(300).regex(/^\//) }),
  z.object({ type: z.literal("export"), what: z.enum(["products.csv"]), count: z.number().int().min(0).optional() }),
]);

export const POST = handle(async (req: Request) => {
  const auth = await authorize();
  const event = await parseBody(req, schema);
  if (event.type === "page") {
    if ((await getConfig()).logs.trackPageViews) await audit({ action: "page.view", category: "navigation", auth, target: event.path, req });
  } else {
    await audit({ action: `export.${event.what}`, category: "inventory", auth, details: event.count !== undefined ? `${event.count} rows` : undefined, req });
  }
  return { ok: true };
});
