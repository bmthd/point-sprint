import { DEFAULT_ACCOUNT_ID } from "../model/account";
import { monthsOf } from "../model/common";
import type { Migration } from "./runner";

// The SPU items as the master defined them at version 10.
const CARD_BONUS_ID = "864f3f89-dacc-4313-a528-dac222c383cc";
const PREMIUM_CARD_BONUS_ID = "b3acca83-be7b-4c8a-9637-7706296679d4";
const BANK_CARD_ID = "1933c19c-0aa3-4052-8d5e-c0d07859a0a9";
const BANK_SALARY_ID = "3a7c47bd-3404-4dcb-9569-54989e63f077";
const SPU_IDS = new Set([
  "c69441cb-ac51-4cf9-8ebd-a909a093907e",
  "9527dde1-c708-44fa-b2cf-5b7b35e0f3d1",
  CARD_BONUS_ID,
  PREMIUM_CARD_BONUS_ID,
  "ca794fa7-4a85-43c6-ab34-e06feb115c5d",
  "c6a1511e-c5e8-4c68-958a-4b1d5dd3ea42",
  "e86e12fd-173a-48a4-995d-2408c4b1d4c2",
  "8cc70769-9599-461e-90f5-6e03ed5e6e7b",
  "ebdcc366-2dd3-48e3-b64b-1a9157698b19",
  "4d4aff27-3536-4162-99a2-c0dd05900df6",
  BANK_CARD_ID,
  BANK_SALARY_ID,
  "783251db-1b47-4c78-aa29-20038fb53dac",
  "a0a88686-e44e-4e28-b755-96babb1aa00d",
  "6569a41a-61a7-47c9-a287-926afe628f66",
  "135ea1c8-2125-4571-9561-e606edf3b9c3",
  "ece41157-00dd-4626-a7f9-24715d505645",
  "92d1dd04-2120-4fab-98a6-a3a72c81c513",
  "7cb3966c-5f5f-42d3-89ad-270a6a77cad8",
  "ac2540d6-b9ad-45d1-9536-552a15213f06",
  "70e5b7c4-87e2-42e6-a650-352b6650784e",
  "6f0d44d9-6c90-4d4d-801d-9e06bc4ae76f",
]);
/** Of two items of an exclusive group both on after merging, the one kept: the larger. */
const LARGER = [
  [CARD_BONUS_ID, PREMIUM_CARD_BONUS_ID],
  [BANK_CARD_ID, BANK_SALARY_ID],
] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EPOCH = "1970-01-01T00:00:00.000Z";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;
const idOf = (value: unknown) => (isRow(value) ? value.id : undefined);

/** The account a plan was calculated with: the default one unless the user tells accounts apart. */
function accountOf(plan: Row, profile: unknown): string {
  const id = plan.accountId;
  if (typeof id !== "string" || !isRow(profile) || profile.multiAccount !== true) {
    return DEFAULT_ACCOUNT_ID;
  }
  const accounts = Array.isArray(profile.accounts) ? profile.accounts : [];
  return accounts.some((account) => idOf(account) === id) ? id : DEFAULT_ACCOUNT_ID;
}

/** The months of a plan's period and of its orders' dates, or none when they cannot be read. */
function monthsOfRow(plan: Row): string[] {
  const period = plan.period;
  if (!isRow(period) || typeof period.start !== "string" || typeof period.end !== "string")
    return [];
  if (!DATE.test(period.start) || !DATE.test(period.end) || period.start > period.end) return [];
  const orders = Array.isArray(plan.orders) ? plan.orders : [];
  const orderMonths = orders.flatMap((order) =>
    isRow(order) && typeof order.date === "string" && DATE.test(order.date)
      ? [order.date.slice(0, 7)]
      : [],
  );
  return [...new Set([...monthsOf({ start: period.start, end: period.end }), ...orderMonths])];
}

/**
 * The SPU of each account and month, from the plans that held their own SPU before version 10.
 * Every month a plan touches gets a row, so a month whose plans had every item off stays off
 * rather than taking the month before it. An item on in any plan of the month is on.
 */
function spuMonthsOf({ plans, profile }: { plans: unknown[]; profile: unknown }): unknown[] {
  const merged = new Map<
    string,
    { accountId: string; month: string; ids: Set<string>; updatedAt: string }
  >();
  for (const plan of plans) {
    if (!isRow(plan) || !Array.isArray(plan.benefits)) continue;
    const accountId = accountOf(plan, profile);
    const on = plan.benefits.flatMap((benefit) => {
      const id = idOf(benefit);
      return typeof id === "string" && SPU_IDS.has(id) && isRow(benefit) && benefit.enabled === true
        ? [id]
        : [];
    });
    const updatedAt = typeof plan.updatedAt === "string" ? plan.updatedAt : EPOCH;
    for (const month of monthsOfRow(plan)) {
      const key = `${accountId}:${month}`;
      const row = merged.get(key) ?? { accountId, month, ids: new Set<string>(), updatedAt };
      for (const id of on) row.ids.add(id);
      if (updatedAt > row.updatedAt) row.updatedAt = updatedAt;
      merged.set(key, row);
    }
  }
  return [...merged.entries()].map(([id, { accountId, month, ids, updatedAt }]) => {
    for (const [smaller, larger] of LARGER) if (ids.has(larger)) ids.delete(smaller);
    return { id, accountId, month, enabledIds: [...ids], updatedAt };
  });
}

const withoutSpu = (row: unknown): unknown =>
  isRow(row) && Array.isArray(row.benefits)
    ? { ...row, benefits: row.benefits.filter((benefit) => !SPU_IDS.has(idOf(benefit) as string)) }
    : row;

const withoutSpuDefaults = (row: unknown): unknown => {
  if (!isRow(row)) return row;
  const { spuBenefits: _, ...rest } = row;
  return rest;
};

/**
 * Moves the SPU out of the plans into one row per account and month (`spuMonths`), and drops the
 * profile's SPU defaults: a new month now takes the SPU of the month before it.
 */
export const spuMonthsMigration: Migration = {
  to: 10,
  stores: { plans: withoutSpu, profile: withoutSpuDefaults },
  seed: { store: "spuMonths", rows: spuMonthsOf },
};
