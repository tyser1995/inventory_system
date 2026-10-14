import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { alerts } from "@/lib/db/repository";
import { alertSettingsSchema } from "@/lib/validation";

/** Readable by any signed-in user (the product form uses the default minimum). */
export const GET = handle(async () => {
  await authorize();
  return alerts.settings();
});

export const PUT = handle(async (req: Request) => {
  await authorize("settings.alerts");
  return alerts.updateSettings(await parseBody(req, alertSettingsSchema));
});
