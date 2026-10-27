import type { D1Database } from "cloudflare:workers";
import { applyMigrations } from "./migrations";

// `pnpm dev` migrates the local databases only as it starts. A dev server left running while a
// pull adds a migration, or one started with `vite dev`, would read tables it lacks: so its Worker
// applies the missing ones itself before the first read. A new file under migrations/ or
// migrations-sync/ reloads this module, and the next read applies it.

const files = {
  events: import.meta.glob<string>("../../../migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  sync: import.meta.glob<string>("../../../migrations-sync/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

const migrated: Partial<Record<keyof typeof files, Promise<unknown>>> = {};

/** `db`, brought up to its migrations on the dev server. Elsewhere, `db` as it is. */
export async function devMigrated(
  db: D1Database,
  which: keyof typeof files = "events",
): Promise<D1Database> {
  if (import.meta.env.DEV) {
    migrated[which] ??= applyMigrations(
      db,
      Object.fromEntries(
        Object.entries(files[which]).map(([path, sql]) => [path.split("/").at(-1) ?? path, sql]),
      ),
    ).catch((error: unknown) => {
      // Tried again on the next read.
      migrated[which] = undefined;
      throw error;
    });
    await migrated[which];
  }
  return db;
}
