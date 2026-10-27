import * as v from "valibot";
import { expect, test } from "vitest";
import { InquiryInputSchema } from "./inquiry-input";

const valid = { name: "", email: "user@example.com", wantsReply: true, body: "質問です" };

function errorsOf(fields: Partial<typeof valid>) {
  const result = v.safeParse(InquiryInputSchema, { ...valid, ...fields });
  if (result.success) return {};
  // The first error of a field is the one it shows.
  return Object.fromEntries(
    result.issues
      .toReversed()
      .map((issue) => [issue.path?.map((key) => key.key).join(".") ?? "", issue.message]),
  );
}

test("a filled-in inquiry has no errors", () => {
  expect(errorsOf({})).toEqual({});
});

test("each field says what to type", () => {
  expect(errorsOf({ name: "あ".repeat(101) })).toEqual({
    name: "お名前は100文字以内で入れてください",
  });
  expect(errorsOf({ email: " " })).toEqual({ email: "返信先のメールアドレスを入れてください" });
  expect(errorsOf({ email: "user@" })).toEqual({ email: "メールアドレスの形で入れてください" });
  expect(errorsOf({ email: `${"a".repeat(250)}@example.com` })).toEqual({
    email: "メールアドレスは254文字以内で入れてください",
  });
  expect(errorsOf({ body: "  " })).toEqual({ body: "お問い合わせの内容を入れてください" });
  expect(errorsOf({ body: "あ".repeat(5001) })).toEqual({
    body: "お問い合わせの内容は5000文字以内で入れてください",
  });
});
