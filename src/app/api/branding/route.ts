import { revalidateTag } from "next/cache";
import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { BRANDING_TAG } from "@/lib/branding";
import { branding } from "@/lib/db/repository";
import { brandingSchema } from "@/lib/validation";

export const GET = handle(() => branding.get());

export const PUT = handle(async (req: Request) => {
  await authorize("settings.branding");
  const updated = await branding.update(await parseBody(req, brandingSchema));
  // Expire immediately so the next render picks up the new title/favicon.
  revalidateTag(BRANDING_TAG, { expire: 0 });
  return updated;
});
