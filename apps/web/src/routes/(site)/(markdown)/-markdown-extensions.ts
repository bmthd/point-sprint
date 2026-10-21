import type { BlockNode, ComponentNode, MarkdownExtension } from "@tanstack/markdown";

/**
 * The `:::name argument` block starting at `index`, up to its closing `:::`. An opening without a
 * closing throws, so a broken page fails the build instead of showing the syntax as text.
 */
function container(lines: string[], index: number, name: string) {
  const found = block(lines, index, new RegExp(`^:::${name}(?:\\s+(.*))?$`));
  return found && { ...found, argument: found.opening[1]?.trim() ?? "" };
}

/** The block whose opening line, at `index`, matches `opening`, up to its closing `:::`. */
function block(lines: string[], index: number, opening: RegExp) {
  const match = lines[index]?.match(opening);
  if (!match) return undefined;
  // The formatter indents a closing right after a list as part of the list's last item.
  const closing = lines.findIndex((line, at) => at > index && line.trim() === ":::");
  if (closing === -1) throw new Error(`${match[0]} has no closing :::`);
  return {
    opening: match,
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

const ALERT_VARIANTS = ["island", "plain", "solid", "subtle", "surface"];

/**
 * `:::info` … `:::`: its blocks in an alert. `success`, `warning` and `error` work the same, and
 * `{variant="solid"}` after the name picks one of Yamada UI's looks for it.
 */
const alert: MarkdownExtension = {
  name: "alert",
  parseBlock(context) {
    const found = block(
      context.lines,
      context.index,
      /^:::(info|success|warning|error)(?:\{(.*)\})?\s*$/,
    );
    const [line, status, braces] = found?.opening ?? [];
    if (!found || line === undefined || status === undefined) return undefined;
    const variant = braces === undefined ? undefined : braces.match(/^variant="(.*)"$/)?.[1];
    if (braces !== undefined && variant === undefined)
      throw new Error(`${line} takes only a variant: {variant="solid"}`);
    if (variant !== undefined && !ALERT_VARIANTS.includes(variant))
      throw new Error(`${line} has no such variant: ${ALERT_VARIANTS.join(", ")}`);
    const properties: Record<string, string> = { status };
    if (variant !== undefined) properties.variant = variant;
    context.consume(found.length);
    return {
      type: "component",
      name: "alert",
      tagName: "md-alert",
      attributes: {},
      properties,
      children: context.parseBlocks(found.body),
    };
  },
};

/** `:::button` with one link inside, `[文言](/path)`: the link drawn as a button that asks to be pressed. */
const button: MarkdownExtension = {
  name: "button",
  parseBlock(context) {
    const block = container(context.lines, context.index, "button");
    if (!block) return undefined;
    const link = block.body.trim().match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (!link?.[1] || !link[2])
      throw new Error(":::button holds one link and nothing else: `[文言](/path)`");
    context.consume(block.length);
    return {
      type: "component",
      name: "button",
      tagName: "md-button",
      attributes: {},
      properties: { href: link[2], label: link[1] },
      children: [],
    };
  },
};

/** The syntax the Markdown pages may use beyond plain Markdown. */
export const markdownExtensions = [details, timeline, alert, button];
