import { handle } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { importBackup } from "@/lib/backup/service";
import { BadRequestError } from "@/lib/errors";

const MAX_BYTES = 50 * 1024 * 1024;

/** Saves an uploaded backup (or raw db.json) as an "imported" backup, ready to restore. */
export const POST = handle(async (req: Request) => {
  await authorize("settings.backup");
  const text = await req.text();
  if (text.length > MAX_BYTES) throw new BadRequestError("File is larger than 50 MB");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new BadRequestError("File is not valid JSON");
  }
  const name = new URL(req.url).searchParams.get("name")?.slice(0, 80);
  return importBackup(payload, name ? `Imported: ${name}` : "Imported file");
});
