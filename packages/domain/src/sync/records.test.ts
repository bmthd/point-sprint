import { expect, test } from "vitest";
import { isNewer } from "./records";

test("a later row wins, and a tie keeps the row here", () => {
  expect(
    isNewer({ updatedAt: "2026-10-05T00:00:01.000Z" }, { updatedAt: "2026-10-05T00:00:00.000Z" }),
  ).toBe(true);
  expect(
    isNewer({ updatedAt: "2026-10-05T00:00:00.000Z" }, { updatedAt: "2026-10-05T00:00:01.000Z" }),
  ).toBe(false);
  expect(
    isNewer({ updatedAt: "2026-10-05T00:00:00.000Z" }, { updatedAt: "2026-10-05T00:00:00.000Z" }),
  ).toBe(false);
  expect(isNewer({ updatedAt: "2026-10-05T00:00:00.000Z" }, undefined)).toBe(true);
});
