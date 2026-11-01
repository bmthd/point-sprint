import { expect, test } from "vitest";
import type { Article } from "./article";
import { recentArticles } from "./recent-articles";

const article = (slug: string, published: string, updated?: string): Article => ({
  slug,
  title: slug,
  description: slug,
  published,
  ...(updated === undefined ? {} : { updated }),
  body: "",
});

test("articles are ordered by the day they were last changed, or published if never", () => {
  const list = recentArticles([
    article("old-changed", "2026-09-01", "2026-10-20"),
    article("new", "2026-10-10"),
    article("old", "2026-09-15"),
  ]);
  expect(list).toEqual([
    { slug: "old-changed", title: "old-changed", date: "2026-10-20" },
    { slug: "new", title: "new", date: "2026-10-10" },
    { slug: "old", title: "old", date: "2026-09-15" },
  ]);
});

test("one more article than the sidebar shows is kept, for the page of one of them", () => {
  const list = recentArticles(
    ["a", "b", "c", "d", "e"].map((slug, index) => article(slug, `2026-10-0${index + 1}`)),
  );
  expect(list.map((item) => item.slug)).toEqual(["e", "d", "c", "b"]);
});
