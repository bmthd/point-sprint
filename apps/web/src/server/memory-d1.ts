import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement } from "cloudflare:workers";

// Tests only: D1 over SQLite in memory, the part of its API the server uses.

/** A D1 in memory with the migrations of `migrations` applied (`migrations/` by default), or none. */
export function memoryD1(migrations: URL | null = new URL("../../migrations/", import.meta.url)): {
  db: D1Database;
  sqlite: DatabaseSync;
} {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  if (migrations) {
    for (const file of readdirSync(migrations).toSorted()) {
      if (file.endsWith(".sql")) sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
    }
  }
  const run = (query: string, values: unknown[]) => {
    const { changes } = sqlite.prepare(query).run(...(values as never[]));
    return { meta: { changes: Number(changes) } };
  };
  const statement = (
    query: string,
    values: unknown[] = [],
  ): D1PreparedStatement & {
    runNow: () => { meta: { changes: number } };
  } => ({
    bind: (...next) => statement(query, next),
    all: async <T>() => ({ results: sqlite.prepare(query).all(...(values as never[])) as T[] }),
    first: async <T>() => (sqlite.prepare(query).get(...(values as never[])) as T) ?? null,
    run: async () => run(query, values),
    runNow: () => run(query, values),
  });
  return {
    sqlite,
    db: {
      prepare: (query) => statement(query),
      // Like D1's, a batch is one transaction.
      batch: async (statements) => {
        sqlite.exec("BEGIN");
        try {
          const results = statements.map((each) => (each as ReturnType<typeof statement>).runNow());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
}
