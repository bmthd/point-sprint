import { expect, test } from "vitest";
import { defaultDescription, defaultTitle, pageHead } from "./page-head";
import { siteUrl } from "./site-url";

test("a page's title follows the site's format, and its OGP repeats it", () => {
  expect(pageHead({ path: "/profile", title: "プロフィール", description: "説明" })).toEqual({
    meta: [
      { title: "プロフィール | ポイントスプリント" },
      { name: "description", content: "説明" },
      { property: "og:title", content: "プロフィール | ポイントスプリント" },
      { property: "og:description", content: "説明" },
      { property: "og:url", content: `${siteUrl}/profile` },
    ],
    links: [{ rel: "canonical", href: `${siteUrl}/profile` }],
  });
});

test("the top page uses the site's own title and description", () => {
  const { meta } = pageHead({ path: "/" });
  expect(meta).toContainEqual({ title: defaultTitle });
  expect(meta).toContainEqual({ name: "description", content: defaultDescription });
  expect(meta).toContainEqual({ property: "og:url", content: `${siteUrl}/` });
});

test("a noindex page tells search engines so", () => {
  expect(pageHead({ path: "/plan", title: "プラン", noindex: true }).meta).toContainEqual({
    name: "robots",
    content: "noindex",
  });
});

test("an article's OGP type is article, with the days it was published and changed", () => {
  const { meta } = pageHead({
    path: "/guides/1000yen-items",
    title: "記事",
    article: { published: "2026-10-08", updated: "2026-10-10" },
  });
  expect(meta).toContainEqual({ property: "og:type", content: "article" });
  expect(meta).toContainEqual({ property: "article:published_time", content: "2026-10-08" });
  expect(meta).toContainEqual({ property: "article:modified_time", content: "2026-10-10" });
  expect(pageHead({ path: "/help", title: "使い方" }).meta).not.toContainEqual(
    expect.objectContaining({ property: "og:type" }),
  );
});
