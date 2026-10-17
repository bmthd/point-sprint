import type { D1Database } from "cloudflare:workers";
import { applyMigrations } from "./migrations";

// `pnpm dev` migrates the local event master only as it starts. A dev server left running while a
// pull adds a migration, or one started with `vite dev`, would read tables it lacks: so its Worker
// applies the missing ones itself before the first read. A new file under migrations/ reloads this
// module, and the next read applies it.

const migrations = import.meta.glob<string>("../../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

let migrated: Promise<unknown> | undefined;

/** `db`, brought up to migrations/ on the dev server. Elsewhere, `db` as it is. */
export async function devMigrated(db: D1Database): Promise<D1Database> {
  if (import.meta.env.DEV) {
    migrated ??= applyMigrations(
      db,
      Object.fromEntries(
        Object.entries(migrations).map(([path, sql]) => [path.split("/").at(-1) ?? path, sql]),
      ),
    ).catch((error: unknown) => {
      // Tried again on the next read.
      migrated = undefined;
      throw error;
    });
    await migrated;
  }
  return db;
}
