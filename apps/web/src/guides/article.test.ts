import { expect, test } from "vitest";
import { articleDates, japaneseDate, newestFirst, parseArticle } from "./article.ts";
import { loadArticle, loadArticles } from "./articles.ts";

const source = (frontmatter: string) => `---\n${frontmatter}\n---\n\n本文の段落\n`;

const fields = `title: 1000円ポッキリで買えるもの
description: "説明: コロンを含む"`;

test("reads the frontmatter, and keeps the Markdown after it as the body", () => {
  expect(parseArticle("1000yen-items", source(fields))).toEqual({
    slug: "1000yen-items",
    title: "1000円ポッキリで買えるもの",
    description: "説明: コロンを含む",
    body: "\n本文の段落\n",
  });
});

test.each([
  { slug: "1000yen-items", source: "本文だけ", error: "no frontmatter" },
  { slug: "Items_1000", source: source(fields), error: "needs a slug" },
  { slug: "a", source: source(fields.replace(/^title.*\n/, "")), error: "title" },
  { slug: "a", source: source(`${fields}\npublished: 2026-10-08`), error: "published" },
  { slug: "a", source: source(`${fields}\nauthor: 誰か`), error: "author" },
  { slug: "a", source: source(`${fields}\nコロンのない行`), error: "cannot read" },
  { slug: "a", source: source(`${fields}\ncardLead: あと1店舗を足すなら`), error: "together" },
  { slug: "a", source: source(`${fields}\ncardFigure: 1,000円ポッキリ`), error: "together" },
])("a guide with a broken frontmatter throws: $error", ({ slug, source, error }) => {
  expect(() => parseArticle(slug, source)).toThrow(error);
});

test("an article is published on the day of its first commit, and changed on that of its last", () => {
  expect(articleDates(["2026-10-28", "2026-10-20", "2026-10-09"], "2026-11-26")).toEqual({
    published: "2026-10-09",
    updated: "2026-10-28",
  });
});

test("an article changed only on the day it was published has no updated day", () => {
  expect(articleDates(["2026-10-09", "2026-10-09"], "2026-11-26")).toEqual({
    published: "2026-10-09",
  });
});

test("an article never committed is published today", () => {
  expect(articleDates([], "2026-11-26")).toEqual({ published: "2026-11-26" });
});

test("lists the newest first", () => {
  const article = (slug: string, published: string) => ({
    ...parseArticle(slug, source("title: t\ndescription: d")),
    published,
  });
  const sorted = newestFirst([
    article("old", "2026-01-01"),
    article("new", "2026-10-01"),
    article("middle", "2026-05-01"),
  ]);
  expect(sorted.map((a) => a.slug)).toEqual(["new", "middle", "old"]);
});

test("writes the day in Japanese", () => {
  expect(japaneseDate("2026-10-08")).toBe("2026年10月8日");
});

test("every guide in articles/ reads, and an unknown slug finds none", async () => {
  const articles = await loadArticles();
  expect(articles.map((a) => a.slug)).toContain("1000yen-items");
  expect(await loadArticle("1000yen-items")).toMatchObject({ title: "1000円ポッキリで買えるもの" });
  expect(await loadArticle("no-such-guide")).toBeUndefined();
});

test("reads the thumbnail's lead and figure", () => {
  const article = parseArticle(
    "a",
    source(`${fields}\ncardLead: あと1店舗を足すなら\ncardFigure: 1,000円ポッキリ`),
  );
  expect(article).toMatchObject({ cardLead: "あと1店舗を足すなら", cardFigure: "1,000円ポッキリ" });
});
