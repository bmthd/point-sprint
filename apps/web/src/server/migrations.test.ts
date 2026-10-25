import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { memoryD1 } from "./memory-d1";
import { applyMigrations } from "./migrations";

const first = {
  "0001_official_events.sql": readFileSync(
    new URL("../../migrations/0001_official_events.sql", import.meta.url),
    "utf8",
  ),
};

const eventCount = (sqlite: DatabaseSync) =>
  sqlite.prepare("SELECT count(*) AS count FROM official_events").get()?.count;

test("an empty database gets every migration", async () => {
  const { db, sqlite } = memoryD1(null);
  await applyMigrations(db, first);
  expect(eventCount(sqlite)).toBe(3);
});

test("a migration already applied is not run again", async () => {
  const { db, sqlite } = memoryD1(null);
  await applyMigrations(db, first);
  await applyMigrations(db, first);
  expect(eventCount(sqlite)).toBe(3);
});

test("a migration added later is applied on its own", async () => {
  const { db, sqlite } = memoryD1(null);
  await applyMigrations(db, first);
  await applyMigrations(db, {
    ...first,
    "0002_more.sql": "-- A comment.\nDELETE FROM official_events\n  WHERE id = 'marathon-2026-10';",
  });
  expect(eventCount(sqlite)).toBe(2);
});
