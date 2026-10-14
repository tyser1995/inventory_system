"use client";

import { Check, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRESETS, TINT_LEVELS, type BackgroundTint, type ThemeMode } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const TINTS: { value: BackgroundTint; label: string; hint: string }[] = [
  { value: "none", label: "Neutral", hint: "Plain grey" },
  { value: "subtle", label: "Subtle", hint: "Hint of color" },
  { value: "rich", label: "Rich", hint: "Fully themed" },
];

const RADII = [
  { value: 0.375, label: "Sharp" },
  { value: 0.75, label: "Soft" },
  { value: 1, label: "Round" },
  { value: 1.5, label: "Pill" },
];

export function ThemeCustomizer({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resetTheme } = useTheme();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Appearance</h3>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-1">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme({ mode: value })}
              className={cn(
                "ring-focus flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
                theme.mode === value ? "bg-surface-solid text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Color presets</h3>
        <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
          {PRESETS.map((p) => {
            const active = p.primary === theme.primary && p.accent === theme.accent;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setTheme({ primary: p.primary, accent: p.accent })}
                className={cn(
                  "ring-focus group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-all",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-muted/40",
                )}
                aria-pressed={active}
              >
                <span className="flex -space-x-1.5">
                  <span className="size-5 rounded-full ring-2 ring-surface-solid" style={{ background: p.primary }} />
                  <span className="size-5 rounded-full ring-2 ring-surface-solid" style={{ background: p.accent }} />
                </span>
                <span className="text-xs font-semibold">{p.name}</span>
                {active && <Check className="absolute top-2 right-2 size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Custom colors</h3>
        <div className="grid grid-cols-2 gap-3">
          {(["primary", "accent"] as const).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-2.5 hover:border-muted/40"
            >
              <span className="relative size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
                <input
                  type="color"
                  value={theme[key]}
                  onChange={(e) => setTheme({ [key]: e.target.value })}
                  className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer"
                  aria-label={`${key} color`}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold capitalize">{key}</span>
                <span className="block font-mono text-xs text-muted uppercase">{theme[key]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Background</h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Background tint">
          {TINTS.map((t) => {
            const pct = TINT_LEVELS[t.value];
            const active = theme.tint === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme({ tint: t.value })}
                className={cn(
                  "ring-focus cursor-pointer overflow-hidden rounded-xl border text-left transition-all",
                  active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted/40",
                )}
              >
                {/* Preview: the same mix the app uses, in light and dark. */}
                <span className="flex h-10">
                  <span className="flex-1" style={{ background: `color-mix(in oklab, ${theme.primary} ${pct}%, #f7f8fb)` }} />
                  <span className="flex-1" style={{ background: `color-mix(in oklab, ${theme.primary} ${pct * 1.4}%, #05070d)` }} />
                </span>
                <span className="block px-2.5 py-2">
                  <span className="block text-xs font-semibold">{t.label}</span>
                  <span className="block text-[11px] text-muted">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Corner radius</h3>
        <div className="grid grid-cols-4 gap-2">
          {RADII.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setTheme({ radius: r.value })}
              className={cn(
                "ring-focus cursor-pointer border py-2 text-xs font-semibold transition-all",
                theme.radius === r.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted hover:text-text",
              )}
              style={{ borderRadius: `${r.value * 0.6}rem` }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={resetTheme}
        className="ring-focus inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-muted hover:text-text"
      >
        <RotateCcw className="size-3.5" /> Reset to Gold &amp; Blue
      </button>
    </div>
  );
}
