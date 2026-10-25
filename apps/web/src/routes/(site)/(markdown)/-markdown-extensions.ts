import type {
  BlockNode,
  ComponentNode,
  InlineNode,
  MarkdownExtension,
  TableCellNode,
} from "@tanstack/markdown";

type BlockContext = Parameters<NonNullable<MarkdownExtension["parseBlock"]>>[0];

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

/** A cell's text without its marks: `**5,000円**` is `5,000円`. */
function textOf(nodes: InlineNode[]): string {
  return nodes
    .map((node) =>
      "value" in node && typeof node.value === "string"
        ? node.value
        : "children" in node
          ? textOf(node.children as InlineNode[])
          : "",
    )
    .join("");
}

/** The number in a text, its commas dropped: `税込 5,500円` is 5500. */
export const amountIn = (text: string) => Number(text.replace(/[^\d.]/g, "")) || 0;

/** The one table of a `:::name` block, or an error naming what the block should hold. */
function tableIn(context: BlockContext, name: string) {
  const block = container(context.lines, context.index, name);
  if (!block) return undefined;
  const [table, ...rest] = context.parseBlocks(block.body);
  if (table?.type !== "table" || rest.length > 0)
    throw new Error(`:::${name} holds one table and nothing else`);
  context.consume(block.length);
  return { table, argument: block.argument, labels: table.header.map((c) => textOf(c.children)) };
}

/** A table cell as a block of its own, named by its column's heading. */
const cell = (cell: TableCellNode, label: string): ComponentNode => ({
  type: "component",
  name: "cell",
  tagName: "md-cell",
  attributes: {},
  properties: { label, ...(textOf(cell.children).trim() === "" && { empty: "true" }) },
  children: [{ type: "paragraph", children: cell.children }],
});

/**
 * `:::name argument` with one table inside, each row of which becomes a `md-name-row` of cells.
 * The block carries the first column's texts (`names`) and the numbers of the last (`amounts`),
 * for the figures that draw the rows to scale.
 */
function tableFigure(name: string): MarkdownExtension {
  return {
    name,
    parseBlock(context) {
      const found = tableIn(context, name);
      if (!found) return undefined;
      const { table, argument, labels } = found;
      return {
        type: "component",
        name,
        tagName: `md-${name}`,
        attributes: {},
        properties: {
          argument,
          names: JSON.stringify(table.rows.map((row) => textOf(row[0]?.children ?? []))),
          amounts: JSON.stringify(
            table.rows.map((row) => amountIn(textOf(row.at(-1)?.children ?? []))),
          ),
        },
        children: table.rows.map((row, index) => ({
          type: "component",
          name: `${name}-row`,
          tagName: `md-${name}-row`,
          attributes: {},
          properties: { index: String(index) },
          children: row.map((c, column) => cell(c, labels[column] ?? "")),
        })),
      };
    },
  };
}

/** `:::flow` with a table of 段階 | 値 | 説明: numbered steps, side by side on a wide screen. */
const flow = tableFigure("flow");

/**
 * `:::breakdown 合計 205P` with a table of 名前 | 計算 | 値: the values as one bar split to scale,
 * each row under it, and the argument as the total.
 */
const breakdown = tableFigure("breakdown");

/**
 * `:::meter 上限 1,000P` with a table of 名前 | 値: the values filling a bar up to the argument's
 * number, so what is left shows as the empty part.
 */
const meter = tableFigure("meter");

/** `:::cards` with a table of 名前 | 強調 | ほかの列…: each row a card, the second column large. */
const cards = tableFigure("cards");

/**
 * `:::compare` with a table whose heading names the things compared and whose first column names
 * what is compared: each thing a card of its own, the last row large.
 */
const compare: MarkdownExtension = {
  name: "compare",
  parseBlock(context) {
    const found = tableIn(context, "compare");
    if (!found) return undefined;
    const { table, labels } = found;
    return {
      type: "component",
      name: "compare",
      tagName: "md-compare",
      attributes: {},
      children: labels.slice(1).map((title, index) => ({
        type: "component",
        name: "compare-item",
        tagName: "md-compare-item",
        attributes: {},
        properties: { title },
        children: table.rows.flatMap((row) => {
          const value = row[index + 1];
          return value ? [cell(value, textOf(row[0]?.children ?? []))] : [];
        }),
      })),
    };
  },
};

/** The syntax the Markdown pages may use beyond plain Markdown. */
export const markdownExtensions = [
  details,
  timeline,
  alert,
  button,
  flow,
  breakdown,
  meter,
  cards,
  compare,
];
