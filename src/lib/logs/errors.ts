import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { appendLog, LOG_DIR, readLogs } from "./files";
import type { ErrorEntry, ErrorGroup, ErrorLevel, ErrorSource, ErrorStatus } from "./types";

/** Mutable triage state per error fingerprint (status/notes), kept beside the append-only occurrence files. */
const STATE_FILE = path.join(LOG_DIR, "error-state.json");
type StateMap = Record<string, { status: ErrorStatus; note?: string; updatedBy?: string; updatedAt?: string }>;

const g = globalThis as typeof globalThis & { __errorState?: { map: StateMap | null; queue: Promise<unknown> } };
const state = (g.__errorState ??= { map: null, queue: Promise.resolve() });

async function loadState(): Promise<StateMap> {
  if (!state.map) {
    try {
      state.map = JSON.parse(await fs.readFile(STATE_FILE, "utf8")) as StateMap;
    } catch {
      state.map = {};
    }
  }
  return state.map;
}

function mutateState(fn: (m: StateMap) => void) {
  const run = state.queue.then(async () => {
    const map = structuredClone(await loadState());
    fn(map);
    await fs.mkdir(LOG_DIR, { recursive: true });
    const tmp = `${STATE_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
    await fs.rename(tmp, STATE_FILE);
    state.map = map;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

/** Groups occurrences of "the same" error: volatile parts (ids, numbers, quoted values) are normalised away. */
function fingerprint(source: ErrorSource, message: string, stack?: string, where?: string) {
  const norm = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/(["'`]).*?\1/g, "<s>")
    .slice(0, 300);
  const frame = stack?.split("\n").find((l) => l.trim().startsWith("at "))?.replace(/:\d+:\d+\)?$/, "").trim() ?? "";
  return createHash("sha1").update(`${source}|${norm}|${frame}|${where ?? ""}`).digest("hex").slice(0, 16);
}

export interface LogErrorInput {
  error?: unknown;
  message?: string;
  source: ErrorSource;
  level?: ErrorLevel;
  stack?: string;
  method?: string;
  path?: string;
  url?: string;
  digest?: string;
  userId?: string;
  userName?: string;
  userAgent?: string;
}

/** Records an error occurrence. Never throws — logging must not break the request that failed. */
export async function logError(input: LogErrorInput) {
  try {
    const err = input.error instanceof Error ? input.error : null;
    const message = (input.message ?? err?.message ?? String(input.error ?? "Unknown error")).slice(0, 2000);
    const stack = (input.stack ?? err?.stack)?.slice(0, 8000);
    const fp = fingerprint(input.source, message, stack, input.source === "client" ? undefined : input.path?.replace(/[0-9a-f-]{36}/gi, ":id"));
    const entry: ErrorEntry = {
      id: crypto.randomUUID(), ts: new Date().toISOString(), fingerprint: fp, level: input.level ?? "error", source: input.source,
      message, name: err?.name, stack, method: input.method, path: input.path, url: input.url?.slice(0, 500), digest: input.digest,
      userId: input.userId, userName: input.userName, userAgent: input.userAgent?.slice(0, 300),
    };
    await appendLog("error", entry);
    // A resolved error that happens again is a regression: reopen it.
    const current = (await loadState())[fp];
    if (current?.status === "resolved") {
      await mutateState((m) => {
        m[fp] = { ...m[fp], status: "open", note: `Reoccurred ${entry.ts.slice(0, 16).replace("T", " ")} after being resolved. ${m[fp].note ?? ""}`.trim() };
      });
    }
    if (input.source !== "client") console.error(`[error-log] ${input.source}: ${message}`);
  } catch (e) {
    console.error("[error-log] failed to record error", e);
  }
}

export async function listErrorGroups(days: number): Promise<ErrorGroup[]> {
  const entries = await readLogs<ErrorEntry>("error", new Date(Date.now() - days * 86_400_000), new Date());
  const map = await loadState();
  const groups = new Map<string, ErrorGroup & { userSet: Set<string> }>();
  for (const e of entries) {
    let gr = groups.get(e.fingerprint);
    if (!gr) {
      const st = map[e.fingerprint];
      gr = {
        fingerprint: e.fingerprint, message: e.message, name: e.name, source: e.source, level: e.level, path: e.path,
        count: 0, users: 0, firstSeen: e.ts, lastSeen: e.ts, status: st?.status ?? "open", note: st?.note,
        updatedBy: st?.updatedBy, updatedAt: st?.updatedAt, userSet: new Set(),
      };
      groups.set(e.fingerprint, gr);
    }
    gr.count++;
    if (e.ts < gr.firstSeen) gr.firstSeen = e.ts;
    if (e.ts > gr.lastSeen) gr.lastSeen = e.ts;
    if (e.userId) gr.userSet.add(e.userId);
  }
  return [...groups.values()]
    .map(({ userSet, ...gr }) => ({ ...gr, users: userSet.size }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export async function getErrorGroup(fp: string, days: number) {
  const entries = (await readLogs<ErrorEntry>("error", new Date(Date.now() - days * 86_400_000), new Date())).filter((e) => e.fingerprint === fp);
  if (!entries.length) return null;
  const st = (await loadState())[fp];
  return { status: st?.status ?? "open", note: st?.note, updatedBy: st?.updatedBy, updatedAt: st?.updatedAt, occurrences: entries.slice(0, 50), total: entries.length };
}

export function setErrorStatus(fps: string[], status: ErrorStatus, by: string, note?: string) {
  return mutateState((m) => {
    for (const fp of fps) m[fp] = { status, note: note ?? m[fp]?.note, updatedBy: by, updatedAt: new Date().toISOString() };
  });
}
