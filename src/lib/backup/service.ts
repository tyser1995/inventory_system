import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_DIR, getConfig } from "../config";
import { BadRequestError, NotFoundError } from "../errors";
import { replaceAll, snapshot } from "../db/store";
import type { Database } from "../types";

export const BACKUP_DIR = path.join(DATA_DIR, "backups");

export type BackupKind = "manual" | "auto" | "scheduled" | "safety" | "imported";

export interface BackupMeta {
  id: string;
  kind: BackupKind;
  label?: string;
  createdAt: string;
  provider: string;
  size: number;
  counts: { products: number; categories: number; suppliers: number; movements: number };
}

interface BackupFile {
  format: "stockvault-backup";
  version: 1;
  meta: Omit<BackupMeta, "id" | "size">;
  data: Database;
}

/** Kinds pruned by the retention policy. Manual, safety and imported backups are kept until deleted. */
const PRUNABLE: BackupKind[] = ["auto", "scheduled"];
const ID_RE = /^[0-9TZ-]+-(manual|auto|scheduled|safety|imported)(-[a-z0-9]{4})?$/;

/* Loose structural check — enough to refuse files that aren't inventory data. */
const databaseShape = z.object({
  version: z.number(),
  branding: z.object({ appName: z.string(), tagline: z.string(), logo: z.string().nullable(), updatedAt: z.string() }).optional(),
  categories: z.array(z.object({ id: z.string(), name: z.string() }).loose()),
  suppliers: z.array(z.object({ id: z.string(), name: z.string() }).loose()),
  products: z.array(z.object({ id: z.string(), sku: z.string(), name: z.string(), quantity: z.number() }).loose()),
  movements: z.array(z.object({ id: z.string(), productId: z.string(), type: z.enum(["IN", "OUT", "ADJUST"]) }).loose()),
});

/** The loose shape check guarantees the core structure; remaining fields are trusted as written by this app. */
const asDatabase = (v: z.infer<typeof databaseShape>) => v as unknown as Database;

function fileFor(id: string) {
  if (!ID_RE.test(id)) throw new NotFoundError("Backup not found");
  return path.join(BACKUP_DIR, `${id}.json`);
}

const countsOf = (d: Database) => ({
  products: d.products.length, categories: d.categories.length, suppliers: d.suppliers.length, movements: d.movements.length,
});

async function writeBackup(kind: BackupKind, data: Database, label?: string): Promise<BackupMeta> {
  const config = await getConfig();
  const createdAt = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 6);
  const id = `${createdAt.replace(/[:.]/g, "-")}-${kind}-${suffix}`;
  const file: BackupFile = {
    format: "stockvault-backup",
    version: 1,
    meta: { kind, label, createdAt, provider: config.provider, counts: countsOf(data) },
    data,
  };
  const json = JSON.stringify(file);
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.writeFile(fileFor(id), json, "utf8");
  await prune(config.backup.retention);
  return { id, ...file.meta, size: Buffer.byteLength(json) };
}

export async function createBackup(kind: BackupKind, label?: string) {
  return writeBackup(kind, await snapshot(), label);
}

/** Snapshot before a risky operation, if the safety policy is on. */
export async function safetyBackup(reason: string) {
  if ((await getConfig()).backup.safety) return createBackup("safety", reason);
  return null;
}

export async function listBackups(): Promise<BackupMeta[]> {
  let names: string[];
  try {
    names = await fs.readdir(BACKUP_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const metas = await Promise.all(
    names
      .filter((n) => n.endsWith(".json") && ID_RE.test(n.slice(0, -5)))
      .map(async (name) => {
        const full = path.join(BACKUP_DIR, name);
        try {
          const [raw, stat] = await Promise.all([fs.readFile(full, "utf8"), fs.stat(full)]);
          const { meta } = JSON.parse(raw) as BackupFile;
          return { id: name.slice(0, -5), ...meta, size: stat.size } satisfies BackupMeta;
        } catch {
          return null; // skip unreadable files
        }
      }),
  );
  return metas.filter((m): m is BackupMeta => m !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readBackupRaw(id: string) {
  try {
    return await fs.readFile(fileFor(id), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundError("Backup not found");
    throw err;
  }
}

export async function deleteBackup(id: string) {
  try {
    await fs.unlink(fileFor(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundError("Backup not found");
    throw err;
  }
}

export async function restoreBackup(id: string) {
  const file = JSON.parse(await readBackupRaw(id)) as BackupFile;
  const data = asDatabase(databaseShape.parse(file.data));
  await safetyBackup(`Before restore: ${file.meta.label ?? `${file.meta.kind} backup`}`);
  await replaceAll(data);
  return countsOf(data);
}

/** Accepts a downloaded backup file or a raw db.json and stores it as an "imported" backup. */
export async function importBackup(payload: unknown, label?: string) {
  const candidate =
    payload && typeof payload === "object" && "format" in payload && (payload as BackupFile).format === "stockvault-backup"
      ? (payload as BackupFile).data
      : payload;
  const parsed = databaseShape.safeParse(candidate);
  if (!parsed.success) throw new ImportError("This file is not a valid inventory backup");
  return writeBackup("imported", asDatabase(parsed.data), label);
}

export class ImportError extends BadRequestError {}

async function prune(retention: number) {
  const all = await listBackups();
  const stale = all.filter((b) => PRUNABLE.includes(b.kind)).slice(Math.max(1, retention));
  await Promise.all(stale.map((b) => fs.unlink(fileFor(b.id)).catch(() => undefined)));
}
