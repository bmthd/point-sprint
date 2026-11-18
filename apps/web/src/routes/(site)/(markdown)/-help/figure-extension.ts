import type { ComponentNode, MarkdownExtension } from "@tanstack/markdown";
import { helpFigureMarks } from "./figure-marks.ts";

/**
 * `:::figure[caption]{name="name" alt="description"}` … `:::`: a figure of the help, drawn by the app's components, with a numbered
 * list inside: item N says what mark N points at. A name
 * without a figure, or items that do not match the marks, fail the build.
 */
export const figureExtension: MarkdownExtension = {
  name: "figure",
  parseBlock(context) {
    const opening = context.lines[context.index];
    if (!opening?.startsWith(":::figure")) return undefined;
    const found = opening.match(/^:::figure\[([^\]]+)\]\{([^{}]*)\}\s*$/);
    const caption = found?.[1]?.trim();
    const attrs = found?.[2];
    if (!caption || attrs === undefined)
      throw new Error('Use :::figure[caption]{name="name" alt="description"} with a numbered list');
    const attributePattern = /([a-z]+)="([^"\n]*)"/g;
    if (attrs.replace(attributePattern, "").trim())
      throw new Error(":::figure attributes must be quoted name and alt values");
    let name: string | undefined;
    let alt: string | undefined;
    for (const [, key, value] of attrs.matchAll(attributePattern)) {
      if (key === "name" && name === undefined) name = value;
      else if (key === "alt" && alt === undefined) alt = value;
      else throw new Error(`:::figure has an unknown or duplicate attribute: ${key}`);
    }
    if (!name || !alt?.trim()) throw new Error(":::figure needs name and alt attributes");
    const closing = context.lines.findIndex(
      (line, index) => index > context.index && line.trim() === ":::",
    );
    if (closing === -1) throw new Error(`${opening} has no closing :::`);
    const body = context.lines.slice(context.index + 1, closing).join("\n");
    const marks = Object.hasOwn(helpFigureMarks, name) ? helpFigureMarks[name] : undefined;
    if (!marks)
      throw new Error(
        `:::figure ${name} has no figure: ${Object.keys(helpFigureMarks).join(", ")}`,
      );
    const blocks = context.parseBlocks(body);
    const [list, ...rest] = blocks;
    const items =
      blocks.length === 0
        ? []
        : list?.type === "list" && list.ordered && rest.length === 0
          ? list.items
          : undefined;
    if (!items) throw new Error(`:::figure ${name} holds one numbered list and nothing else`);
    if (items.length !== marks.length)
      throw new Error(`:::figure ${name} has ${marks.length} marks but ${items.length} items`);
    context.consume(closing - context.index + 1);
    const callouts = items.map((item, index): ComponentNode => ({
      type: "component",
      name: "figure-callout",
      tagName: "md-figure-callout",
      attributes: {},
      properties: { step: String(index + 1) },
      children: item.children,
    }));
    return {
      type: "component",
      name: "figure",
      tagName: "md-figure",
      attributes: {},
      properties: { name, caption, alt },
      children: callouts,
    };
  },
};
