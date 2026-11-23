import { expect, test } from "vitest";
import { whenText } from "./settings-shared.ts";

test.each([
  [[1], "毎月1日"],
  [[18], "毎月18日"],
  [[5, 10, 15, 20, 25, 30], "毎月5・10・15・20・25・30日"],
])("固定日の規則を一覧に出す %j", (days, text) => {
  expect(whenText({ type: "daysOfMonth", days })).toBe(text);
});
