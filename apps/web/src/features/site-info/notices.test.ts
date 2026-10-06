import * as v from "valibot";
import { expect, test } from "vitest";
import { formatNoticeDate, newestFirst, notices } from "./notices";

test("puts the newest notice first", () => {
  const list = [
    { date: "2023-09-01", title: "b", body: [] },
    { date: "2023-11-24", title: "c", body: [] },
    { date: "2023-08-24", title: "a", body: [] },
  ];
  expect(newestFirst(list).map((notice) => notice.title)).toEqual(["c", "b", "a"]);
});

test("every notice has a real date, a title and a body", () => {
  const schema = v.object({
    date: v.pipe(v.string(), v.isoDate()),
    title: v.pipe(v.string(), v.nonEmpty()),
    body: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty())), v.minLength(1)),
  });
  for (const notice of notices) expect(() => v.parse(schema, notice), notice.title).not.toThrow();
});

test("writes the date with slashes", () => {
  expect(formatNoticeDate("2023-11-24")).toBe("2023/11/24");
});
