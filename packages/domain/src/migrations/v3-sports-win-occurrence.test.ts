import { expect, test } from "vitest";
import { migrateRow } from "./index";

test("moves the caps of 勝ったら倍 in a plan saved at version 2 to an occurrence", () => {
  const saved = {
    id: "p",
    benefits: [
      { id: "a", sharedKey: "sports-win", capScope: "day" },
      { id: "b", sharedKey: "pointday", capScope: "month" },
      { id: "c", capScope: "day" },
    ],
  };
  expect(migrateRow("plans", saved, 2)).toEqual({
    id: "p",
    benefits: [
      { id: "a", sharedKey: "sports-win", capScope: "occurrence" },
      { id: "b", sharedKey: "pointday", capScope: "month" },
      { id: "c", capScope: "day" },
    ],
  });
});

test("leaves a plan saved at version 3 as it is", () => {
  const saved = { id: "p", benefits: [{ id: "a", sharedKey: "sports-win", capScope: "day" }] };
  expect(migrateRow("plans", saved, 3)).toEqual(saved);
});
