import { expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import { capGroupKey } from "./cap-groups";

const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
const BENEFIT_ID = "5b000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "acc00000-0000-4000-8000-000000000001";
const PLAN = { id: PLAN_ID, accountId: ACCOUNT_ID };

const benefit = (over: Partial<Benefit> = {}): Benefit =>
  ({
    id: BENEFIT_ID,
    kind: "rate-bonus",
    category: "spu",
    label: "bonus",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "plan",
    conditions: {},
    params: { rate: 1, roundingUnit: "item" },
    ...over,
  }) as Benefit;

test("plan scope key", () => {
  expect(capGroupKey(PLAN, benefit(), "2026-10-05")).toBe(`plan:${PLAN_ID}:${BENEFIT_ID}`);
});

test("month scope uses sharedKey and order month", () => {
  expect(
    capGroupKey(PLAN, benefit({ capScope: "month", sharedKey: "spu-card" }), "2026-10-05"),
  ).toBe(`month:${ACCOUNT_ID}:spu-card:2026-10`);
});

test("occurrence scope uses sharedKey and the benefit's days, not the order date", () => {
  const sportsWin = (dates: string[]) =>
    benefit({
      capScope: "occurrence",
      sharedKey: "sports-win",
      conditions: { dateRule: { type: "dates", dates } },
    });
  expect(capGroupKey(PLAN, sportsWin(["2026-10-01"]), "2026-10-05")).toBe(
    `occurrence:${ACCOUNT_ID}:sports-win:2026-10-01`,
  );
  expect(capGroupKey(PLAN, sportsWin(["2026-10-06", "2026-10-04"]), "2026-10-05")).toBe(
    `occurrence:${ACCOUNT_ID}:sports-win:2026-10-04,2026-10-06`,
  );
  const range = benefit({
    capScope: "occurrence",
    sharedKey: "x",
    conditions: { dateRule: { type: "range", start: "2026-10-01", end: "2026-10-03" } },
  });
  expect(capGroupKey(PLAN, range, "2026-10-02")).toBe(
    `occurrence:${ACCOUNT_ID}:x:2026-10-01~2026-10-03`,
  );
  expect(capGroupKey(PLAN, benefit({ capScope: "occurrence" }), "2026-10-05")).toBe(
    `occurrence:${ACCOUNT_ID}:${BENEFIT_ID}`,
  );
});

test("campaign scope uses sharedKey", () => {
  expect(
    capGroupKey(PLAN, benefit({ capScope: "campaign", sharedKey: "marathon" }), "2026-10-05"),
  ).toBe(`campaign:${ACCOUNT_ID}:marathon`);
});

test("plan scope key does not depend on the account", () => {
  const other = { id: PLAN_ID, accountId: "acc00000-0000-4000-8000-000000000002" };
  expect(capGroupKey(other, benefit(), "2026-10-05")).toBe(
    capGroupKey(PLAN, benefit(), "2026-10-05"),
  );
});

test.each(["campaign", "month", "occurrence"] as const)(
  "%s scope keys differ by account",
  (capScope) => {
    const other = { id: PLAN_ID, accountId: "acc00000-0000-4000-8000-000000000002" };
    const shared = benefit({ capScope, sharedKey: "marathon" });
    expect(capGroupKey(other, shared, "2026-10-05")).not.toBe(
      capGroupKey(PLAN, shared, "2026-10-05"),
    );
  },
);
