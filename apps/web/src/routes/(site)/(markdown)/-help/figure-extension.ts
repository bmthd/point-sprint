import type { ComponentNode, MarkdownExtension } from "@tanstack/markdown";
import { helpFigures } from "./figures.tsx";

/**
 * `:::figure{name="name"}` … `:::`: a figure of the help, drawn by the app's components, with a numbered
 * list inside: item N says what mark N points at. A name
 * without a figure, or items that do not match the marks, fail the build.
 */
export const figureExtension: MarkdownExtension = {
  name: "figure",
  parseBlock(context) {
    const opening = context.lines[context.index];
    if (!opening?.startsWith(":::figure")) return undefined;
    const name = opening.match(/^:::figure\{name="([\w-]+)"\}\s*$/)?.[1];
    if (!name) throw new Error('Use :::figure{name="name"} with a numbered list');
    const closing = context.lines.findIndex(
      (line, index) => index > context.index && line.trim() === ":::",
    );
    if (closing === -1) throw new Error(`${opening} has no closing :::`);
    const body = context.lines.slice(context.index + 1, closing).join("\n");
    const spec = helpFigures[name];
    if (!spec)
      throw new Error(`:::figure ${name} has no figure: ${Object.keys(helpFigures).join(", ")}`);
    const blocks = context.parseBlocks(body);
    const [list, ...rest] = blocks;
    const items =
      blocks.length === 0
        ? []
        : list?.type === "list" && list.ordered && rest.length === 0
          ? list.items
          : undefined;
    if (!items) throw new Error(`:::figure ${name} holds one numbered list and nothing else`);
    if (items.length !== spec.marks.length)
      throw new Error(`:::figure ${name} has ${spec.marks.length} marks but ${items.length} items`);
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
      properties: { name: name },
      children: callouts,
    };
  },
};
