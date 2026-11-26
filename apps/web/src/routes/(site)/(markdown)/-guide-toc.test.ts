import { renderHtml } from "@tanstack/markdown/html";
import { expect, test } from "vitest";
import { loadArticles } from "#/guides/articles.ts";
import { guideExtensions } from "#/guides/markdown.ts";
import { guideSections, splitIntroduction } from "./-guide-toc.tsx";
import { headingIds } from "./-markdown-body.tsx";

test("each guide's contents link to the `##` and `###` headings it has, in order", async () => {
  for (const { body } of await loadArticles()) {
    const html = renderHtml(body, { headingIds, extensions: guideExtensions });
    const headings = [...html.matchAll(/<h([23]) id="([^"]+)"/g)].map(([, level, id]) => ({
      title: id,
      level: Number(level),
    }));
    expect(guideSections(body)).toEqual(headings);
  }
});

test("splits the introduction from the sections, without losing any of the body", () => {
  const body = "導入の段落\n\n## 1つ目\n\n本文\n\n## 2つ目\n";
  const [introduction, sections] = splitIntroduction(body);
  expect(introduction).toBe("導入の段落\n\n");
  expect(sections).toBe("## 1つ目\n\n本文\n\n## 2つ目\n");
});

test("a body with no sections is all introduction", () => {
  expect(splitIntroduction("導入だけ\n")).toEqual(["導入だけ\n", ""]);
});
