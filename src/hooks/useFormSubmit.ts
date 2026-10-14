"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ApiError, refreshAll } from "@/lib/client";

/** Shared submit lifecycle: busy flag, server field errors, toast, global revalidation. */
export function useFormSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setErrors({});
    try {
      await action();
      await refreshAll();
      toast(success);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, errors, setErrors, submit };
}
