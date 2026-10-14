import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../config";

/**
 * Append-only JSONL log files, one per kind per day: data/logs/<kind>-YYYY-MM-DD.jsonl
 * Kept outside the inventory database so high-volume writes never touch backups or Supabase sync.
 */
export const LOG_DIR = path.join(DATA_DIR, "logs");
export type LogKind = "audit" | "error";

const day = (d: Date) => d.toISOString().slice(0, 10);
const fileFor = (kind: LogKind, d: Date) => path.join(LOG_DIR, `${kind}-${day(d)}.jsonl`);

export async function appendLog(kind: LogKind, entry: object) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.appendFile(fileFor(kind, new Date()), JSON.stringify(entry) + "\n", "utf8");
}

/** Reads entries between two dates (inclusive), newest first. Corrupt lines are skipped. */
export async function readLogs<T extends { ts: string }>(kind: LogKind, from: Date, to: Date): Promise<T[]> {
  let names: string[];
  try {
    names = await fs.readdir(LOG_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const lo = day(from);
  const hi = day(to);
  const re = new RegExp(`^${kind}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`);
  const days = names
    .map((n) => n.match(re)?.[1])
    .filter((d): d is string => !!d && d >= lo && d <= hi)
    .sort()
    .reverse();

  const out: T[] = [];
  for (const d of days) {
    const raw = await fs.readFile(path.join(LOG_DIR, `${kind}-${d}.jsonl`), "utf8");
    const entries: T[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        /* skip partial/corrupt line */
      }
    }
    out.push(...entries.reverse());
  }
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return out.filter((e) => {
    const t = Date.parse(e.ts);
    return t >= fromMs && t <= toMs;
  });
}

/** Deletes daily files older than `days`. */
export async function pruneLogs(days: number) {
  const cutoff = day(new Date(Date.now() - days * 86_400_000));
  let names: string[] = [];
  try {
    names = await fs.readdir(LOG_DIR);
  } catch {
    return 0;
  }
  const old = names.filter((n) => {
    const d = n.match(/-(\d{4}-\d{2}-\d{2})\.jsonl$/)?.[1];
    return d && d < cutoff;
  });
  await Promise.all(old.map((n) => fs.unlink(path.join(LOG_DIR, n)).catch(() => undefined)));
  return old.length;
}

export async function logStorageSize() {
  try {
    const names = await fs.readdir(LOG_DIR);
    const stats = await Promise.all(names.map((n) => fs.stat(path.join(LOG_DIR, n))));
    return stats.reduce((s, st) => s + st.size, 0);
  } catch {
    return 0;
  }
}
