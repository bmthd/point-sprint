import type { BlockNode, ComponentNode, MarkdownExtension } from "@tanstack/markdown";

/**
 * The `:::name argument` block starting at `index`, up to its closing `:::`. An opening without a
 * closing throws, so a broken page fails the build instead of showing the syntax as text.
 */
function container(lines: string[], index: number, name: string) {
  const opening = lines[index]?.match(new RegExp(`^:::${name}(?:\\s+(.*))?$`));
  if (!opening) return undefined;
  // The formatter indents a closing right after a list as part of the list's last item.
  const closing = lines.findIndex((line, at) => at > index && line.trim() === ":::");
  if (closing === -1) throw new Error(`:::${name} has no closing :::`);
  return {
    argument: opening[1]?.trim() ?? "",
    body: lines.slice(index + 1, closing).join("\n"),
    length: closing - index + 1,
  };
}

/** `:::details 見出し` … `:::`: a section closed until its heading is pressed. */
const details: MarkdownExtension = {
  name: "details",
  parseBlock(context) {
    const block = container(context.lines, context.index, "details");
    if (!block) return undefined;
    if (!block.argument) throw new Error(":::details needs a heading: `:::details 見出し`");
    context.consume(block.length);
    return {
      type: "component",
      name: "details",
      tagName: "md-details",
      attributes: { summary: block.argument },
      properties: { summary: block.argument },
      children: context.parseBlocks(block.body),
    };
  },
};

/** `:::timeline` with one numbered list inside: each item becomes a numbered step. */
const timeline: MarkdownExtension = {
  name: "timeline",
  parseBlock(context) {
    const block = container(context.lines, context.index, "timeline");
    if (!block) return undefined;
    const [list, ...rest] = context.parseBlocks(block.body);
    if (list?.type !== "list" || !list.ordered || rest.length > 0)
      throw new Error(":::timeline holds one numbered list (`1. …`) and nothing else");
    context.consume(block.length);
    const steps = list.items.map((item, index): ComponentNode => ({
      type: "component",
      name: "timeline-step",
      tagName: "md-timeline-step",
      attributes: {},
      properties: { step: String(index + 1) },
      children: item.children satisfies BlockNode[],
    }));
    return {
      type: "component",
      name: "timeline",
      tagName: "md-timeline",
      attributes: {},
      children: steps,
    };
  },
};

/** The syntax the Markdown pages may use beyond plain Markdown. */
export const markdownExtensions = [details, timeline];
