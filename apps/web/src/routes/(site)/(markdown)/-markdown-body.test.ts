import { renderHtml } from "@tanstack/markdown/html";
import { expect, test } from "vitest";
import about from "./-markdown/about.md?raw";
import help from "./-markdown/help.md?raw";
import privacy from "./-markdown/privacy.md?raw";
import terms from "./-markdown/terms.md?raw";
import { aboutExtension } from "./-about/about-page.tsx";
import { headingIds } from "./-markdown-body.tsx";
import { markdownExtensions } from "./-markdown-extensions.ts";

test.each([
  { name: "利用規約", source: terms },
  { name: "使い方", source: help },
  { name: "プライバシーポリシー", source: privacy },
  { name: "このサイトについて", source: about },
])("$name starts with its title and links only to sections it has", ({ name, source }) => {
  const html = renderHtml(source, {
    headingIds,
    extensions: [...markdownExtensions, aboutExtension],
  });
  expect(html).toMatch(new RegExp(`^<h1 id="${name}">${name}</h1>`));
  const ids = [...html.matchAll(/<h\d id="([^"]+)"/g)].map(([, id]) => id);
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id);
  for (const anchor of anchors) expect(ids).toContain(anchor);
});
