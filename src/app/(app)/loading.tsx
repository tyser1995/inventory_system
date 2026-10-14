import { Loader2 } from "lucide-react";

/** Shown in the content area while the next page loads. */
export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <Loader2 className="size-8 animate-spin text-primary" />
        </span>
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
}
