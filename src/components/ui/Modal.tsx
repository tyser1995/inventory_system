"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

/** Native dialog element: focus trap, Esc and top-layer for free. Renders as a bottom sheet on mobile. */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 mt-auto max-h-none w-full max-w-none bg-transparent p-0 text-text",
        "sm:m-auto sm:w-[calc(100%-2rem)]",
        widths[size],
      )}
    >
      {open && (
        <div className="animate-pop flex max-h-[92dvh] flex-col rounded-t-[var(--radius)] border border-border bg-surface-solid shadow-2xl sm:rounded-[var(--radius)]">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ring-focus -m-1 cursor-pointer rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
