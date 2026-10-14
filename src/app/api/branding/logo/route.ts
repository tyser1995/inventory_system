import { branding } from "@/lib/db/repository";

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Default mark: brand-gradient tile with the app's initial. */
function fallbackSvg(appName: string) {
  const initial = escapeXml((appName.trim()[0] ?? "S").toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#d4a017"/></linearGradient></defs>
<rect width="64" height="64" rx="16" fill="url(#g)"/>
<text x="32" y="43" font-family="system-ui,sans-serif" font-size="32" font-weight="700" text-anchor="middle" fill="#fff">${initial}</text>
</svg>`;
}

/** Serves the uploaded logo (used as favicon). */
export async function GET() {
  const b = await branding.get();
  const headers = {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    // Uploaded SVGs could carry scripts — never let them execute if opened directly.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  };

  const match = b.logo?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return new Response(fallbackSvg(b.appName), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  return new Response(Buffer.from(match[2], "base64"), { headers: { ...headers, "Content-Type": match[1] } });
}
