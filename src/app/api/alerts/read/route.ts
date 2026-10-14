import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { alerts } from "@/lib/db/repository";

const schema = z.object({ ids: z.array(z.string().uuid()).max(500).optional() });

/** Marks the given alerts (or all, when no ids) as read for the caller. */
export const POST = handle(async (req: Request) => {
  const auth = await authorize("products.view");
  const { ids } = await parseBody(req, schema);
  return alerts.markRead(auth.user.id, ids);
});
