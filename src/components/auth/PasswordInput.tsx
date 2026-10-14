"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/Field";

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input ref={ref} type={show ? "text" : "password"} className="pr-10 pl-9" {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="ring-focus absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted hover:text-text"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);

/** 0–4 rough strength score for UI feedback only (server enforces the 8-char minimum). */
export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordStrength(password);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-surface-2"}`} />
        ))}
      </div>
      <span className="w-16 text-right text-[11px] text-muted">{labels[score]}</span>
    </div>
  );
}
