import { handle, parseBody } from "@/lib/api";
import { authorize } from "@/lib/auth/guard";
import { switchProvider } from "@/lib/db/provider";
import { switchProviderSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await authorize("settings.database");
  const { provider, mode } = await parseBody(req, switchProviderSchema);
  return switchProvider(provider, mode);
});
