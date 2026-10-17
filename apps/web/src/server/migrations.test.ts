import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement } from "cloudflare:workers";
import { expect, test } from "vitest";
import { applyMigrations } from "./migrations";

const first = {
  "0001_official_events.sql": readFileSync(
    new URL("../../migrations/0001_official_events.sql", import.meta.url),
    "utf8",
  ),
};

/** An empty D1 over SQLite in memory: the part of its API the migrations use. */
function memoryD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const statement = (query: string, values: unknown[] = []): D1PreparedStatement => ({
    bind: (...next) => statement(query, next),
    all: async <T>() => ({ results: sqlite.prepare(query).all(...(values as never[])) as T[] }),
    run: async () => sqlite.prepare(query).run(...(values as never[])),
  });
  return {
    sqlite,
    db: {
      prepare: (query) => statement(query),
      batch: async (statements) => {
        for (const each of statements) await each.run();
      },
    },
  };
}

const eventCount = (sqlite: DatabaseSync) =>
  sqlite.prepare("SELECT count(*) AS count FROM official_events").get()?.count;

test("an empty database gets every migration", async () => {
  const { db, sqlite } = memoryD1();
  await applyMigrations(db, first);
  expect(eventCount(sqlite)).toBe(3);
});

test("a migration already applied is not run again", async () => {
  const { db, sqlite } = memoryD1();
  await applyMigrations(db, first);
  await applyMigrations(db, first);
  expect(eventCount(sqlite)).toBe(3);
});

test("a migration added later is applied on its own", async () => {
  const { db, sqlite } = memoryD1();
  await applyMigrations(db, first);
  await applyMigrations(db, {
    ...first,
    "0002_more.sql": "-- A comment.\nDELETE FROM official_events\n  WHERE id = 'marathon-2026-10';",
  });
  expect(eventCount(sqlite)).toBe(2);
});
