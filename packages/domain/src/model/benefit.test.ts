import * as v from "valibot";
import { expect, test } from "vitest";
import { BenefitSchema } from "../benefit-kinds";

test("benefit defaults amountBasis and capScope", () => {
  const benefit = v.parse(BenefitSchema, {
    id: "3f2b8c1e-5d4a-4e7b-9a10-1c2d3e4f5a6b",
    kind: "rate-bonus",
    category: "spu",
    label: "bonus",
    enabled: true,
    params: { rate: 1 },
  });
  expect(benefit.amountBasis).toBe("tax-excluded");
  expect(benefit.capScope).toBe("plan");
});

test("benefit category accepts base", () => {
  const benefit = v.parse(BenefitSchema, {
    id: "3f2b8c1e-5d4a-4e7b-9a10-1c2d3e4f5a6b",
    kind: "rate-bonus",
    category: "base",
    label: "base points",
    enabled: true,
    params: { rate: 1 },
  });
  expect(benefit.category).toBe("base");
});
