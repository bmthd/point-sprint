import { renderHtml } from "@tanstack/markdown/html";
import { expect, test } from "vitest";
import help from "../../markdown/help.md?raw";
import terms from "../../markdown/terms.md?raw";
import { headingIds } from "./-markdown-body";
import { markdownExtensions } from "./-markdown-extensions";

test.each([
  { name: "利用規約", source: terms },
  { name: "使い方・注意事項", source: help },
])("$name starts with its title and links only to sections it has", ({ name, source }) => {
  const html = renderHtml(source, { headingIds, extensions: markdownExtensions });
  expect(html).toMatch(new RegExp(`^<h1 id="${name}">${name}</h1>`));
  const ids = [...html.matchAll(/<h\d id="([^"]+)"/g)].map(([, id]) => id);
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id);
  for (const anchor of anchors) expect(ids).toContain(anchor);
});
