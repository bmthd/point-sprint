import * as v from "valibot";
import { expect, test } from "vitest";
import { BANK_CARD_ID, BANK_SALARY_ID, standardSpu } from "../master/spu";
import { BenefitSchema } from "../model/benefit";
import { migrateRow, migrations } from "./index";

// Version 10 moves the SPU out of plans and profiles; these tests look at the rows before it.
const beforeSpuMonths = migrations.filter((migration) => migration.to < 10);

const MOBILE_ID = "ca794fa7-4a85-43c6-ab34-e06feb115c5d";
const master = (id: string) => standardSpu.find((benefit) => benefit.id === id);
const { exclusiveGroup: _group, ...salary } = master(BANK_SALARY_ID) ?? {};
const savedBank = { ...salary, label: "楽天銀行（楽天カード引落）", enabled: true };

test("splits the saved 楽天銀行 of a plan into the two tiers, keeping +0.5 on", () => {
  const migrated = migrateRow(
    "plans",
    { id: "p", benefits: [{ id: MOBILE_ID }, savedBank] },
    8,
    beforeSpuMonths,
  );
  expect(migrated).toEqual({
    id: "p",
    benefits: [
      { id: MOBILE_ID },
      master(BANK_CARD_ID),
      { ...master(BANK_SALARY_ID), enabled: true },
    ],
  });
});

test("splits the saved 楽天銀行 of the profile", () => {
  const migrated = migrateRow("profile", { spuBenefits: [savedBank] }, 8, beforeSpuMonths) as {
    spuBenefits: unknown[];
  };
  expect(migrated.spuBenefits.map((benefit) => v.parse(BenefitSchema, benefit).id)).toEqual([
    BANK_CARD_ID,
    BANK_SALARY_ID,
  ]);
});

test("leaves rows without 楽天銀行 as they are", () => {
  expect(
    migrateRow("plans", { id: "p", benefits: [{ id: MOBILE_ID }] }, 8, beforeSpuMonths),
  ).toEqual({
    id: "p",
    benefits: [{ id: MOBILE_ID }],
  });
});
