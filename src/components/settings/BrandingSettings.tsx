"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { BrandName, Logo } from "@/components/layout/Sidebar";
import { useBranding } from "@/components/theme/BrandingProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";

const MAX_DIMENSION = 256;
const MAX_BYTES = 512 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const DEFAULTS = { appName: "StockVault", tagline: "Inventory Suite", logo: null as string | null };

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Downscales raster images to ≤256px (keeps transparency) so the stored logo stays small. */
async function prepareLogo(file: File): Promise<string> {
  if (!ACCEPT.includes(file.type)) throw new Error("Use a PNG, JPG, WebP, GIF or SVG image");
  if (file.type === "image/svg+xml") {
    if (file.size > MAX_BYTES) throw new Error("SVG must be under 512 KB");
    return readAsDataUrl(file);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/png");
  if (url.length * 0.75 > MAX_BYTES) return canvas.toDataURL("image/webp", 0.9);
  return url;
}

export function BrandingSettings() {
  const current = useBranding();
  const router = useRouter();
  const toast = useToast();
  const { busy, errors, submit } = useFormSubmit();
  const [form, setForm] = useState({ appName: current.appName, tagline: current.tagline, logo: current.logo });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = form.appName !== current.appName || form.tagline !== current.tagline || form.logo !== current.logo;
  const isDefault = form.appName === DEFAULTS.appName && form.tagline === DEFAULTS.tagline && form.logo === null;
  const previewName = form.appName.trim() || DEFAULTS.appName;

  async function onFile(file?: File | null) {
    if (!file) return;
    try {
      const logo = await prepareLogo(file);
      setForm((f) => ({ ...f, logo }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const ok = await submit(() => api("/api/branding", { method: "PUT", json: form }), "Branding updated");
    // Re-render server components so the <title> and favicon pick up the change.
    if (ok) router.refresh();
  }

  return (
    <form onSubmit={onSave} className="grid gap-6 p-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <Field label="Application name" error={errors.appName} hint="Shown in the sidebar and the browser tab">
          <Input value={form.appName} onChange={(e) => setForm((f) => ({ ...f, appName: e.target.value }))} maxLength={40} required />
        </Field>
        <Field label="Tagline" error={errors.tagline} hint="Optional — appears under the name">
          <Input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} maxLength={60} placeholder="Inventory Suite" />
        </Field>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Logo</span>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
            className={cn(
              "ring-focus flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-surface-2/50",
            )}
          >
            <Logo src={form.logo} className="size-14 rounded-2xl" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-1.5 font-semibold"><ImageUp className="size-4 text-primary" /> Click or drop an image</p>
              <p className="mt-0.5 text-xs text-muted">PNG, JPG, WebP, GIF or SVG · square works best · resized to 256px</p>
            </div>
          </div>
          {errors.logo && <span className="block text-xs text-danger">{errors.logo}</span>}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          {form.logo && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, logo: null }))}
              className="ring-focus inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-muted hover:text-danger"
            >
              <Trash2 className="size-3.5" /> Remove logo (use default icon)
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="submit" loading={busy} disabled={!dirty}>Save branding</Button>
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => setForm({ appName: current.appName, tagline: current.tagline, logo: current.logo })}>
              Discard
            </Button>
          )}
          {!isDefault && (
            <Button type="button" variant="ghost" className="ml-auto" onClick={() => setForm({ ...DEFAULTS })}>
              <RotateCcw className="size-4" /> Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-3">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Preview</span>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 bg-surface-2 px-3 py-2">
            <span className="flex gap-1">
              <span className="size-2 rounded-full bg-danger/60" />
              <span className="size-2 rounded-full bg-warning/60" />
              <span className="size-2 rounded-full bg-success/60" />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-surface-solid px-2 py-1 text-[11px]">
              <Logo src={form.logo} className="size-3.5 rounded-[4px] [&>svg]:size-2.5" />
              <span className="truncate">{form.tagline ? `${previewName} — ${form.tagline}` : previewName}</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 bg-surface-solid p-4">
            <Logo src={form.logo} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-bold tracking-tight"><BrandName name={previewName} /></span>
              {form.tagline && <span className="block truncate text-[11px] font-medium text-muted">{form.tagline}</span>}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted">Branding is saved to the local database and applies to every browser using this workspace.</p>
      </div>
    </form>
  );
}
