import { expect, test } from "vitest";
import { CARD_BONUS_ID, CARD_NORMAL_ID, PREMIUM_CARD_BONUS_ID } from "../master/spu";
import { migrateRow } from "./index";

const MOBILE_ID = "ca794fa7-4a85-43c6-ab34-e06feb115c5d";
const saved = () => [
  { id: CARD_NORMAL_ID },
  { id: CARD_BONUS_ID },
  { id: PREMIUM_CARD_BONUS_ID },
  { id: MOBILE_ID },
];
const linked = [
  { id: CARD_NORMAL_ID },
  { id: CARD_BONUS_ID, requires: CARD_NORMAL_ID },
  { id: PREMIUM_CARD_BONUS_ID, requires: CARD_NORMAL_ID },
  { id: MOBILE_ID },
];

test("links the card bonuses of a plan saved at version 1", () => {
  expect(migrateRow("plans", { id: "p", benefits: saved() }, 1)).toEqual({
    id: "p",
    benefits: linked,
  });
});

test("links the card bonuses of the profile saved at version 1", () => {
  expect(migrateRow("profile", { spuBenefits: saved() }, 1)).toEqual({ spuBenefits: linked });
});

test("leaves shops as they are", () => {
  expect(migrateRow("shops", { id: "s" }, 1)).toEqual({ id: "s" });
});
