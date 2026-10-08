import { expect, test } from "vitest";
import { japaneseDate, newestFirst, parseArticle } from "./article";
import { loadArticle, loadArticles } from "./articles";

const source = (frontmatter: string) => `---\n${frontmatter}\n---\n\n本文の段落\n`;

const fields = `title: 1000円ポッキリで買えるもの
description: "説明: コロンを含む"
published: 2026-10-08
updated: 2026-10-10`;

test("reads the frontmatter, and keeps the Markdown after it as the body", () => {
  expect(parseArticle("1000yen-items", source(fields))).toEqual({
    slug: "1000yen-items",
    title: "1000円ポッキリで買えるもの",
    description: "説明: コロンを含む",
    published: "2026-10-08",
    updated: "2026-10-10",
    body: "\n本文の段落\n",
  });
});

test.each([
  { slug: "1000yen-items", source: "本文だけ", error: "no frontmatter" },
  { slug: "Items_1000", source: source(fields), error: "needs a slug" },
  { slug: "a", source: source(fields.replace(/^title.*\n/, "")), error: "title" },
  { slug: "a", source: source(fields.replace("2026-10-08", "10/8")), error: "published" },
  { slug: "a", source: source(fields.replace("2026-10-10", "2026-10-01")), error: "before" },
  { slug: "a", source: source(`${fields}\nauthor: 誰か`), error: "author" },
  { slug: "a", source: source(`${fields}\nコロンのない行`), error: "cannot read" },
])("a guide with a broken frontmatter throws: $error", ({ slug, source, error }) => {
  expect(() => parseArticle(slug, source)).toThrow(error);
});

test("lists the newest first", () => {
  const article = (slug: string, day: string) =>
    parseArticle(slug, source(`title: t\ndescription: d\npublished: ${day}\nupdated: ${day}`));
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
