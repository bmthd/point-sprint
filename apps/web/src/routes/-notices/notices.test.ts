import { expect, test } from "vitest";
import { type Notice, newestFirst, notices, paragraphs } from "./notices";

const notice = (date: string, title: string): Notice => ({ id: title, date, title, body: "" });

test("newestFirst puts the latest notice first and keeps the listed order within a day", () => {
  const sorted = newestFirst([
    notice("2026-10-01", "古い"),
    notice("2026-11-03", "新しい"),
    notice("2026-10-15", "同じ日の1つ目"),
    notice("2026-10-15", "同じ日の2つ目"),
  ]);
  expect(sorted.map((n) => n.title)).toEqual(["新しい", "同じ日の1つ目", "同じ日の2つ目", "古い"]);
});

test("paragraphs splits the body on blank lines", () => {
  expect(paragraphs("1つ目\nの続き\n\n2つ目\n  \n3つ目\n")).toEqual([
    "1つ目\nの続き",
    "2つ目",
    "3つ目",
  ]);
});

test.each(notices)(
  "the notice $title has a real date, a title and a body",
  ({ id, date, title, body }) => {
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
    expect(title.trim()).not.toBe("");
    expect(paragraphs(body).length).toBeGreaterThan(0);
  },
);

test("every notice has its own id", () => {
  expect(new Set(notices.map((n) => n.id)).size).toBe(notices.length);
});
