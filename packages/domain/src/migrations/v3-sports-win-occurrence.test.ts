import { expect, test } from "vitest";
import { migrateRow } from "./index";

test("moves saved sports-win caps from a day to an occurrence", () => {
  expect(
    migrateRow(
      "plans",
      {
        id: "p",
        benefits: [
          { id: "sports", sharedKey: "sports-win", capScope: "day" },
          { id: "other", sharedKey: "sports-win", capScope: "campaign" },
        ],
      },
      2,
    ),
  ).toEqual({
    id: "p",
    benefits: [
      { id: "sports", sharedKey: "sports-win", capScope: "occurrence" },
      { id: "other", sharedKey: "sports-win", capScope: "campaign" },
    ],
  });
});
