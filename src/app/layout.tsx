import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { BrandingProvider } from "@/components/theme/BrandingProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorReporter } from "@/components/logs/ErrorReporter";
import { ToastProvider } from "@/components/ui/Toast";
import { getBranding } from "@/lib/branding";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { appName, tagline, updatedAt } = await getBranding();
  return {
    title: { default: tagline ? `${appName} — ${tagline}` : appName, template: `%s · ${appName}` },
    description: `${appName} inventory management system`,
    // Version query busts the browser's favicon cache when the logo changes.
    icons: { icon: `/api/branding/logo?v=${Date.parse(updatedAt)}` },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const branding = await getBranding();
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Browser extensions (e.g. Grammarly) inject body attributes before hydration. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <ErrorReporter />
        <ThemeProvider>
          <BrandingProvider initial={branding}>
            <ToastProvider>
              {children}
            </ToastProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
