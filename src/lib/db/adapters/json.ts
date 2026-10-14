import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../../config";
import type { Database } from "../../types";
import type { StorageAdapter } from "./types";

const DB_FILE = /* turbopackIgnore: true */ process.env.INVENTORY_DB_FILE ?? path.join(/* turbopackIgnore: true */ DATA_DIR, "db.json");

/** Local JSON file. Atomic writes; mtime tracking picks up changes from other module instances/processes. */
export function createJsonAdapter(): StorageAdapter {
  let mtimeMs = 0;

  return {
    name: "local",

    async load() {
      try {
        const stat = await fs.stat(DB_FILE);
        const data = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Database;
        mtimeMs = stat.mtimeMs;
        return data;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async save(next) {
      await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
      const tmp = `${DB_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
      await fs.rename(tmp, DB_FILE);
      mtimeMs = (await fs.stat(DB_FILE)).mtimeMs;
    },

    async isStale() {
      try {
        return (await fs.stat(DB_FILE)).mtimeMs !== mtimeMs;
      } catch {
        return true;
      }
    },
  };
}
