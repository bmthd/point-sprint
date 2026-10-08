import * as v from "valibot";
import { expect, test } from "vitest";
import { type FormSpec, campaignFormSchema } from "./campaign-form";

const valid = {
  label: "",
  date: "2026-10-05",
  start: "2026-10-04",
  end: "2026-10-11",
  rate: "1",
  minOrderAmount: "3,980",
  cap: "",
};

/** The errors of each field of a template's form. */
function errorsOf(spec: Partial<FormSpec>, fields: Partial<typeof valid>) {
  const result = v.safeParse(campaignFormSchema({ hint: "", ...spec }), { ...valid, ...fields });
  if (result.success) return {};
  // The first error of a field is the one it shows.
  return Object.fromEntries(
    result.issues
      .toReversed()
      .map((issue) => [issue.path?.map((key) => key.key).join(".") ?? "", issue.message]),
  );
}

test("a filled-in form has no errors", () => {
  expect(errorsOf({}, {})).toEqual({});
  expect(errorsOf({ cap: "required" }, { cap: "1,000P" })).toEqual({});
});

test("dates must be dates, and the period must not end before it starts", () => {
  expect(errorsOf({}, { date: "" })).toEqual({ date: "日付を入れてください" });
  expect(errorsOf({}, { start: "" })).toEqual({ start: "開始日を入れてください" });
  expect(errorsOf({}, { end: "2026/10/11" })).toEqual({
    end: "終了日は YYYY-MM-DD の形で入れてください",
  });
  expect(errorsOf({}, { start: "2026-10-11", end: "2026-10-11" })).toEqual({});
  expect(errorsOf({}, { start: "2026-10-12", end: "2026-10-11" })).toEqual({
    end: "終了日は開始日と同じ日か、それより後の日にしてください",
  });
});

test("the rate, the order amount and the cap say what to type", () => {
  expect(errorsOf({}, { rate: "0" })).toEqual({ rate: "倍率は0より大きい数で入れてください" });
  expect(errorsOf({}, { rate: "101" })).toEqual({ rate: "倍率は100以下で入れてください" });
  expect(errorsOf({}, { minOrderAmount: "" })).toEqual({
    minOrderAmount: "条件金額を入れてください",
  });
  expect(errorsOf({}, { minOrderAmount: "3980.5" })).toEqual({
    minOrderAmount: "条件金額は0以上の整数で入れてください",
  });
  expect(errorsOf({}, { cap: "abc" })).toEqual({ cap: "獲得上限は0以上の整数で入れてください" });
  expect(errorsOf({}, { label: "あ".repeat(51) })).toEqual({
    label: "名前は50文字以内で入れてください",
  });
});

test("a cap is asked for only when the template needs one", () => {
  expect(errorsOf({ cap: "optional" }, { cap: "" })).toEqual({});
  expect(errorsOf({ cap: "required" }, { cap: "" })).toEqual({ cap: "獲得上限を入れてください" });
});
