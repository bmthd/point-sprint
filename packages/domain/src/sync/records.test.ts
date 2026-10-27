import { expect, test } from "vitest";
import { type SyncRow, wins } from "./records";

const row = (updatedAt: string, value: unknown = { name: "a" }): SyncRow => ({
  kind: "shop",
  id: "s",
  updatedAt,
  deleted: false,
  value,
});
const EARLIER = "2026-10-05T00:00:00.000Z";
const LATER = "2026-10-05T00:00:01.000Z";

test("a later row wins and an earlier one does not", () => {
  expect(wins(row(LATER), row(EARLIER))).toBe(true);
  expect(wins(row(EARLIER), row(LATER))).toBe(false);
  expect(wins(row(EARLIER), undefined)).toBe(true);
});

test("a row of the same time wins only when it differs", () => {
  expect(wins(row(EARLIER, { name: "b" }), row(EARLIER, { name: "a" }))).toBe(true);
  expect(wins(row(EARLIER, { b: 1, a: 2 }), row(EARLIER, { a: 2, b: 1 }))).toBe(false);
  expect(wins({ kind: "shop", id: "s", updatedAt: EARLIER, deleted: true }, row(EARLIER))).toBe(
    true,
  );
});
