import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { branding } from "./db/repository";

export const BRANDING_TAG = "branding";

/** Cached branding read for server rendering (metadata). Invalidated via BRANDING_TAG on update. */
export async function getBranding() {
  "use cache";
  cacheTag(BRANDING_TAG);
  cacheLife("max");
  return branding.get();
}
