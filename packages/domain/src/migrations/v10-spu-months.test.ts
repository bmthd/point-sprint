import * as v from "valibot";
import { describe, expect, test } from "vitest";
import {
  BANK_CARD_ID,
  BANK_SALARY_ID,
  BOOKS_SPU_ID,
  CARD_BONUS_ID,
  CARD_NORMAL_ID,
  PREMIUM_CARD_BONUS_ID,
  standardSpu,
} from "../master/spu";
import { DEFAULT_ACCOUNT_ID } from "../model/account";
import { ProfileSchema } from "../model/plan";
import { SpuMonthSchema } from "../model/spu-month";
import { migrateRow, seedRows } from "./index";

const ACCOUNT_2 = "acc00000-0000-4000-8000-000000000002";
const EVENT_BENEFIT = { id: "e0000000-0000-4000-8000-000000000001" };
const spu = (on: string[]) =>
  standardSpu.map((benefit) => ({ ...benefit, enabled: on.includes(benefit.id) }));

const plan = (over: Record<string, unknown>) => ({
  id: "p",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
  ...over,
});

const seeded = (plans: unknown[], profile?: unknown) =>
  (seedRows({ plans, profile }, 9).spuMonths ?? []).map((row) => v.parse(SpuMonthSchema, row));
const enabledOf = (
  rows: { month: string; accountId: string; enabledIds: string[] }[],
  month: string,
  accountId = DEFAULT_ACCOUNT_ID,
) => new Set(rows.find((row) => row.month === month && row.accountId === accountId)?.enabledIds);

describe("plans and profile", () => {
  test("the SPU leaves the plan, and the other benefits stay", () => {
    const migrated = migrateRow(
      "plans",
      plan({ benefits: [...spu([BOOKS_SPU_ID]), EVENT_BENEFIT] }),
      9,
    );
    expect(migrated).toEqual(plan({ benefits: [EVENT_BENEFIT] }));
  });

  test("the profile loses its SPU defaults", () => {
    const migrated = migrateRow(
      "profile",
      { spuBenefits: spu([]), updatedAt: "2026-10-05T00:00:00.000Z" },
      9,
    );
    expect(migrated).toEqual({ updatedAt: "2026-10-05T00:00:00.000Z" });
    expect(v.safeParse(ProfileSchema, migrated).success).toBe(true);
  });
});

describe("spuMonths", () => {
  test("each month of a plan's period and orders gets the plan's SPU", () => {
    const rows = seeded([
      plan({
        period: { start: "2026-10-25", end: "2026-11-02" },
        benefits: spu([BOOKS_SPU_ID]),
        orders: [{ date: "2026-12-01" }],
      }),
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      `${DEFAULT_ACCOUNT_ID}:2026-10`,
      `${DEFAULT_ACCOUNT_ID}:2026-11`,
      `${DEFAULT_ACCOUNT_ID}:2026-12`,
    ]);
    expect(enabledOf(rows, "2026-12")).toEqual(new Set([BOOKS_SPU_ID]));
  });

  test("plans of one month that disagree: on in any of them is on", () => {
    const rows = seeded([
      plan({ id: "a", benefits: spu([CARD_NORMAL_ID, CARD_BONUS_ID]) }),
      plan({ id: "b", benefits: spu([BOOKS_SPU_ID]), updatedAt: "2026-10-09T00:00:00.000Z" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(enabledOf(rows, "2026-10")).toEqual(
      new Set([CARD_NORMAL_ID, CARD_BONUS_ID, BOOKS_SPU_ID]),
    );
    expect(rows[0]?.updatedAt).toBe("2026-10-09T00:00:00.000Z");
  });

  test("of an exclusive group both on, the larger one is kept", () => {
    const rows = seeded([
      plan({ id: "a", benefits: spu([CARD_NORMAL_ID, CARD_BONUS_ID, BANK_SALARY_ID]) }),
      plan({ id: "b", benefits: spu([CARD_NORMAL_ID, PREMIUM_CARD_BONUS_ID, BANK_CARD_ID]) }),
    ]);
    expect(enabledOf(rows, "2026-10")).toEqual(
      new Set([CARD_NORMAL_ID, PREMIUM_CARD_BONUS_ID, BANK_SALARY_ID]),
    );
  });

  test("a month whose plans had everything off gets a row with nothing on", () => {
    expect(enabledOf(seeded([plan({ benefits: spu([]) })]), "2026-10")).toEqual(new Set());
  });

  test("plans of another account are kept apart only while the user tells accounts apart", () => {
    const plans = [
      plan({ benefits: spu([]) }),
      plan({ id: "b", accountId: ACCOUNT_2, benefits: spu([BOOKS_SPU_ID]) }),
    ];
    const apart = { multiAccount: true, accounts: [{ id: ACCOUNT_2, name: "サブ" }] };
    expect(enabledOf(seeded(plans, apart), "2026-10")).toEqual(new Set());
    expect(enabledOf(seeded(plans, apart), "2026-10", ACCOUNT_2)).toEqual(new Set([BOOKS_SPU_ID]));
    const together = seeded(plans, { ...apart, multiAccount: false });
    expect(together).toHaveLength(1);
    expect(enabledOf(together, "2026-10")).toEqual(new Set([BOOKS_SPU_ID]));
    const deleted = seeded(plans, { multiAccount: true, accounts: [] });
    expect(enabledOf(deleted, "2026-10")).toEqual(new Set([BOOKS_SPU_ID]));
  });

  test("rows it cannot read are skipped", () => {
    const rows = seeded([
      null,
      { id: "x" },
      plan({ period: { start: "bad", end: "2026-10-31" }, benefits: spu([BOOKS_SPU_ID]) }),
      plan({ benefits: spu([BANK_SALARY_ID]) }),
    ]);
    expect(rows).toHaveLength(1);
    expect(enabledOf(rows, "2026-10")).toEqual(new Set([BANK_SALARY_ID]));
  });

  test("a plan saved at version 8 is migrated to version 9 before it is read", () => {
    const { exclusiveGroup: _, ...oldBank } =
      standardSpu.find((b) => b.id === BANK_SALARY_ID) ?? {};
    const rows = (seedRows(
      { plans: [plan({ benefits: [{ ...oldBank, enabled: true }] })], profile: undefined },
      8,
    ).spuMonths ?? []) as { enabledIds: string[] }[];
    expect(rows[0]?.enabledIds).toEqual([BANK_SALARY_ID]);
  });
});
