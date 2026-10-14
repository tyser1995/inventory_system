import type { Database } from "../../types";

/**
 * Persistence backend for the whole inventory dataset.
 * The repository works on an in-memory snapshot; adapters only load and save it.
 */
export interface StorageAdapter {
  readonly name: "local" | "supabase";
  /** Returns null when the backend has never been initialised. */
  load(): Promise<Database | null>;
  /** Persists `next`. `prev` (last known state) lets adapters write only what changed. */
  save(next: Database, prev: Database | null): Promise<void>;
  /** True if the cached snapshot may be stale (e.g. the file changed on disk). */
  isStale(): Promise<boolean>;
}
