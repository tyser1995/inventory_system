import "server-only";
import { getConfig, updateConfig } from "../config";
import { onCommit } from "../db/store";
import { logError } from "../logs/errors";
import { pruneLogs } from "../logs/files";
import { previousSlot } from "./schedule";
import { createBackup } from "./service";

/**
 * Background backup runner, started once per server from instrumentation.ts.
 * - Scheduled: checks every minute whether a schedule slot has passed since the last run.
 * - Auto: after data changes, backs up once the configured interval has elapsed.
 * Requires a long-running server (`next dev` / `next start`), not serverless.
 */
const TICK_MS = 60_000;
const DEBOUNCE_MS = 5_000;

type SchedulerState = { started: boolean; autoTimer: ReturnType<typeof setTimeout> | null; running: boolean; lastPrune?: string };
const g = globalThis as typeof globalThis & { __backupScheduler?: SchedulerState };
const state: SchedulerState = (g.__backupScheduler ??= { started: false, autoTimer: null, running: false });

async function runScheduled() {
  const { backup } = await getConfig();
  if (!backup.schedule.enabled || state.running) return;
  const slot = previousSlot(new Date(), backup.schedule);
  const last = backup.lastScheduledAt ? Date.parse(backup.lastScheduledAt) : 0;
  if (last >= slot) return;
  state.running = true;
  try {
    await createBackup("scheduled");
    await updateConfig((c) => void (c.backup.lastScheduledAt = new Date().toISOString()));
  } catch (err) {
    await logError({ error: err, source: "background", message: `Scheduled backup failed: ${(err as Error).message}`, path: "backup.scheduled" });
  } finally {
    state.running = false;
  }
}

async function runAuto() {
  state.autoTimer = null;
  try {
    await createBackup("auto");
    await updateConfig((c) => void (c.backup.lastAutoAt = new Date().toISOString()));
  } catch (err) {
    await logError({ error: err, source: "background", message: `Auto backup failed: ${(err as Error).message}`, path: "backup.auto" });
  }
}

/** Called after every data write. Never awaited inside the write itself. */
async function onDataChanged() {
  const { backup } = await getConfig();
  if (!backup.auto.enabled || state.autoTimer) return;
  const last = backup.lastAutoAt ? Date.parse(backup.lastAutoAt) : 0;
  const dueIn = last + backup.auto.intervalMinutes * 60_000 - Date.now();
  // Debounce bursts of edits; otherwise wait until the interval has elapsed.
  state.autoTimer = setTimeout(runAuto, Math.max(DEBOUNCE_MS, dueIn));
}

export function startBackupScheduler() {
  if (state.started) return;
  state.started = true;
  onCommit(() => void onDataChanged().catch((e) => console.error("[backup]", e)));
  setInterval(() => {
    void runScheduled();
    void pruneDaily();
  }, TICK_MS).unref?.();
  void runScheduled();
  void pruneDaily();
  console.log("[backup] scheduler started");
}

/** Applies log retention once per calendar day. */
async function pruneDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastPrune === today) return;
  state.lastPrune = today;
  try {
    await pruneLogs((await getConfig()).logs.retentionDays);
  } catch (err) {
    await logError({ error: err, source: "background", path: "logs.prune" });
  }
}

/** Cancels a pending auto backup (e.g. when auto backup is turned off). */
export function cancelPendingAuto() {
  if (state.autoTimer) clearTimeout(state.autoTimer);
  state.autoTimer = null;
}
