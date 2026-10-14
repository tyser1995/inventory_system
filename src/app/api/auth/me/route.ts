import { handle, parseBody } from "@/lib/api";
import { updateOwnProfile } from "@/lib/auth/accounts";
import { authorize } from "@/lib/auth/guard";
import { profileSchema } from "@/lib/validation";

export const GET = handle(async () => authorize());

export const PATCH = handle(async (req: Request) => {
  const auth = await authorize();
  return updateOwnProfile(auth, await parseBody(req, profileSchema));
});
