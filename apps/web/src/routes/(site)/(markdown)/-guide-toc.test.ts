import { renderHtml } from "@tanstack/markdown/html";
import { expect, test } from "vitest";
import { loadArticles } from "../../../guides/articles";
import { guideExtensions } from "../../../guides/markdown";
import { guideSections, splitIntroduction } from "./-guide-toc";
import { headingIds } from "./-markdown-body";

test("each guide's contents link to the `##` headings it has, in order", async () => {
  for (const { body } of await loadArticles()) {
    const html = renderHtml(body, { headingIds, extensions: guideExtensions });
    const h2Ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map(([, id]) => id);
    expect(guideSections(body)).toEqual(h2Ids);
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
