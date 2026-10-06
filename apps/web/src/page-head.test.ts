import { expect, test } from "vitest";
import { defaultDescription, defaultTitle, pageHead } from "./page-head";

test("a page's title follows the site's format, and its OGP repeats it", () => {
  expect(pageHead({ path: "/profile", title: "プロフィール", description: "説明" })).toEqual({
    meta: [
      { title: "プロフィール | ポイントスプリント" },
      { name: "description", content: "説明" },
      { property: "og:title", content: "プロフィール | ポイントスプリント" },
      { property: "og:description", content: "説明" },
      { property: "og:url", content: "https://point-sprint.bmth.dev/profile" },
    ],
    links: [{ rel: "canonical", href: "https://point-sprint.bmth.dev/profile" }],
  });
});

test("the top page uses the site's own title and description", () => {
  const { meta } = pageHead({ path: "/" });
  expect(meta).toContainEqual({ title: defaultTitle });
  expect(meta).toContainEqual({ name: "description", content: defaultDescription });
  expect(meta).toContainEqual({ property: "og:url", content: "https://point-sprint.bmth.dev/" });
});

test("a noindex page tells search engines so", () => {
  expect(pageHead({ path: "/plan", title: "プラン", noindex: true }).meta).toContainEqual({
    name: "robots",
    content: "noindex",
  });
});
