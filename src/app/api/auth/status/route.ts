import { handle } from "@/lib/api";
import { needsSetup } from "@/lib/auth/accounts";
import { getAuth } from "@/lib/auth/guard";

/** Public: tells the login page whether first-run setup is needed and whether a session is active. */
export const GET = handle(async () => ({ needsSetup: await needsSetup(), signedIn: Boolean(await getAuth()) }));
