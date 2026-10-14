export type ThemeMode = "light" | "dark" | "system";

export type BackgroundTint = "none" | "subtle" | "rich";

/** Percent of the primary color mixed into backgrounds (see --tint in globals.css). */
export const TINT_LEVELS: Record<BackgroundTint, number> = { none: 0, subtle: 5, rich: 10 };

export interface ThemeSettings {
  mode: ThemeMode;
  primary: string;
  accent: string;
  radius: number; // rem
  /** How strongly backgrounds and surfaces are tinted with the primary color. */
  tint: BackgroundTint;
}

export const THEME_STORAGE_KEY = "inventory.theme";

export const DEFAULT_THEME: ThemeSettings = {
  mode: "system",
  primary: "#2563eb",
  accent: "#d4a017",
  radius: 1,
  tint: "subtle",
};

export const PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "Royal Gold", primary: "#2563eb", accent: "#d4a017" },
  { name: "Midnight", primary: "#1e3a8a", accent: "#f5c542" },
  { name: "Emerald", primary: "#059669", accent: "#f59e0b" },
  { name: "Amethyst", primary: "#7c3aed", accent: "#f472b6" },
  { name: "Ocean", primary: "#0891b2", accent: "#fb7185" },
  { name: "Graphite", primary: "#334155", accent: "#eab308" },
];

/** Picks black or white text for a given background hex (WCAG relative luminance). */
export function readableOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast vs white: 1.05/(L+.05); vs near-black (#0b0f19 ≈ L .005): (L+.05)/.055
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.055 ? "#ffffff" : "#0b0f19";
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: ThemeSettings) {
  const root = document.documentElement;
  root.dataset.theme = resolveMode(t.mode);
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--primary-fg", readableOn(t.primary));
  root.style.setProperty("--accent-fg", readableOn(t.accent));
  root.style.setProperty("--radius", `${t.radius}rem`);
  root.style.setProperty("--tint", String(TINT_LEVELS[t.tint] ?? TINT_LEVELS.subtle));
}

/**
 * Inline script run before first paint to avoid a theme flash.
 * Kept dependency-free since it's stringified into <head>.
 */
export const themeInitScript = `(function(){try{
var d=${JSON.stringify(DEFAULT_THEME)};
var s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"null")||{};
var t=Object.assign({},d,s);
var m=t.mode==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t.mode;
var r=document.documentElement;r.dataset.theme=m;
r.style.setProperty("--primary",t.primary);r.style.setProperty("--accent",t.accent);
r.style.setProperty("--radius",t.radius+"rem");
r.style.setProperty("--tint",String(${JSON.stringify(TINT_LEVELS)}[t.tint]??${TINT_LEVELS.subtle}));
}catch(e){document.documentElement.dataset.theme="light";}})();`;
