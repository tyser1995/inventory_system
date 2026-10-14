"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

const SHOW_AFTER = 320; // px scrolled before the button appears
const R = 22;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Floating "back to top" button with a scroll-progress ring. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(y > SHOW_AFTER);
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function scrollToTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "ring-focus group fixed right-4 bottom-28 z-30 grid size-12 cursor-pointer place-items-center rounded-full lg:right-6 lg:bottom-6",
        "border border-border bg-surface-solid/90 text-primary shadow-[0_10px_30px_-10px_var(--primary)] backdrop-blur",
        "transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-primary-fg",
        visible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-90 opacity-0",
      )}
    >
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 48 48" aria-hidden>
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <ArrowUp className="relative size-5 transition-transform group-hover:-translate-y-0.5" />
    </button>
  );
}
