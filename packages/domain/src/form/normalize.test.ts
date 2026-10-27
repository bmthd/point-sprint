import * as v from "valibot";
import { expect, test } from "vitest";
import { toDate, toNumber, toOptionalText, toText } from "./normalize";

test("a number drops full-width forms, commas, spaces and its unit's signs", () => {
  expect(v.parse(toNumber("yen"), " ¥１１，０００ ")).toBe(11000);
  expect(v.parse(toNumber("yen"), "3,980円")).toBe(3980);
  expect(v.parse(toNumber("points"), "７，０００Ｐ")).toBe(7000);
  expect(v.parse(toNumber("points"), "7000ポイント")).toBe(7000);
  expect(v.parse(toNumber("rate"), "＋２．５倍")).toBe(2.5);
  expect(v.parse(toNumber("quantity"), "２個")).toBe(2);
  expect(v.parse(toNumber("yen"), "-1")).toBe(-1);
});

test("an empty number field is undefined, and text that is not a number is NaN", () => {
  expect(v.parse(toNumber("yen"), "　")).toBeUndefined();
  expect(v.parse(toNumber("yen"), "12a")).toBeNaN();
  // Only plain digits are read: not a hexadecimal or an exponent.
  expect(v.parse(toNumber("yen"), "0x10")).toBeNaN();
  expect(v.parse(toNumber("yen"), "1e3")).toBeNaN();
  // A sign belongs to its own unit only.
  expect(v.parse(toNumber("yen"), "3倍")).toBeNaN();
});

test("a date is made half-width, and an empty one is undefined", () => {
  expect(v.parse(toDate, " ２０２６-１０-０５ ")).toBe("2026-10-05");
  expect(v.parse(toDate, "")).toBeUndefined();
});

test("text loses the spaces around it", () => {
  expect(v.parse(toText, " 近所の店 ")).toBe("近所の店");
  expect(v.parse(toText, "  ")).toBe("");
  expect(v.parse(toOptionalText, "  ")).toBeUndefined();
  // Text is not made half-width: a name keeps the letters it was typed with.
  expect(v.parse(toText, "ＡＢＣ")).toBe("ＡＢＣ");
});
