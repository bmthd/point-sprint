import type { D1Database } from "cloudflare:workers";

// Applies migrations/ and migrations-sync/ to the local databases: by scripts/migrate-db.ts, and by
// the dev server's Worker (dev-migrations.worker.ts). Free of runtime imports, so that Node can run it. Production
// and the Previews are migrated by `cf`, which keeps the same table.

/** The table `cf d1 migrations apply` records the migrations it applied in. */
const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/** A migration's statements, comments left out: a prepared statement takes only one. */
function statements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join(" ")
    .split(/;\s*(?=\S|$)/)
    .filter((statement) => statement.trim());
}

/**
 * Applies the migrations, by file name, that `db` has not had, in their order. Each is applied
 * together with its record, or not at all.
 */
export async function applyMigrations(
  db: D1Database,
  migrations: Record<string, string>,
): Promise<string[]> {
  await db.prepare(CREATE_MIGRATIONS_TABLE).run();
  const { results } = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const applied = new Set(results.map(({ name }) => name));
  const pending = Object.keys(migrations)
    .filter((name) => !applied.has(name))
    .toSorted();
  for (const name of pending) {
    await db.batch([
      ...statements(migrations[name] ?? "").map((statement) => db.prepare(statement)),
      db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(name),
    ]);
  }
  return pending;
}
