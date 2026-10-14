"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportClientError } from "@/components/logs/ErrorReporter";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Page-level error boundary: reports the crash and lets the user retry without a full reload. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportClientError(error, "boundary", error.digest), [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle className="size-7" /></span>
      <h2 className="mt-4 text-lg font-semibold">This page hit a problem</h2>
      <p className="mt-1 text-sm text-muted">The error has been logged for an administrator. You can try again.</p>
      {error.digest && <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={() => retry()}><RotateCcw className="size-4" /> Try again</Button>
    </Card>
  );
}
