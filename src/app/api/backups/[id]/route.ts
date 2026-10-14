import { handle, type IdContext } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { deleteBackup, readBackupRaw } from "@/lib/backup/service";

/** Downloads the backup file. */
export const GET = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("settings.backup");
  const { id } = await params;
  const raw = await readBackupRaw(id);
  return new Response(raw, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stockvault-backup-${id}.json"`,
    },
  });
});

export const DELETE = handle(async (_req: Request, { params }: IdContext) => {
  await authorize("settings.backup");
  return deleteBackup((await params).id);
});
