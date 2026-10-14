import { revalidateTag } from "next/cache";
import { handle, type IdContext } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { restoreBackup } from "@/lib/backup/service";
import { BRANDING_TAG } from "@/lib/branding";

export const POST = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("settings.backup");
  const counts = await restoreBackup((await params).id);
  revalidateTag(BRANDING_TAG, { expire: 0 });
  return { ok: true, counts };
});
