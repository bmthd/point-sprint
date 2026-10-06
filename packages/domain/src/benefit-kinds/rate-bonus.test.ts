import * as v from "valibot";
import { expect, test } from "vitest";
import { rateBonus } from "./rate-bonus";

test("default params parse", () => {
  expect(v.parse(rateBonus.paramsSchema, { rate: 1 }).roundingUnit).toBe("item");
});
