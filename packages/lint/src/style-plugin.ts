import { definePlugin, defineRule } from "@oxlint/plugins";
import { conditions, styleProperties } from "@yamada-ui/react/core";

const styleProps = new Set<string>(styleProperties);

/** Whether the attribute takes a style: a style prop, a pseudo prop (`_hover`) or `css`. */
function isStyleProp(name: string) {
  return name === "css" || name.startsWith("_") || styleProps.has(name);
}

function isFunction(type: unknown) {
  return (
    type === "ArrowFunctionExpression" ||
    type === "FunctionExpression" ||
    type === "FunctionDeclaration"
  );
}

function isConditional(node: { type?: unknown; operator?: unknown }) {
  return (
    node.type === "ConditionalExpression" ||
    (node.type === "LogicalExpression" &&
      (node.operator === "&&" || node.operator === "||" || node.operator === "??"))
  );
}

/** Whether the expression branches on a condition, outside the functions it holds. */
function branches(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some(branches);
  const expression = node as { type?: unknown; operator?: unknown };
  if (isFunction(expression.type)) return false;
  if (isConditional(expression)) return true;
  return Object.entries(node).some(([key, value]) => key !== "parent" && branches(value));
}

export const noConditionalStyle = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow choosing a style prop's value with a condition.",
    },
    messages: {
      conditional:
        '`{{name}}` の値を条件で分けない。状態は `data-*`（`dataAttr`）か `aria-*` の属性で要素に出し、CSS はその属性を見て書く（`_checked`、`css={{ "&[data-held]": { ... } }}`、`"[data-held] &"`）。並びや中身で決まるものは `:empty` や `:has()` などのセレクタで書く。',
    },
  },
  create(context) {
    return {
      JSXAttribute(attribute) {
        if (attribute.name.type !== "JSXIdentifier") return;
        const { name } = attribute.name;
        if (!isStyleProp(name)) return;
        if (attribute.value?.type !== "JSXExpressionContainer") return;
        if (branches(attribute.value.expression)) {
          context.report({ node: attribute, messageId: "conditional", data: { name } });
        }
      },
    };
  },
});

/** A selector with its spaces made the same, so `& > *` and `&>*` read alike. */
function normalize(selector: string) {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,()])\s*/g, "$1")
    .replaceAll('"', "'")
    .trim();
}

/**
 * Each selector Yamada UI has a pseudo prop for, and the prop. The `focus-within` ones are left
 * out: in 2.3.3 they read `&:not(:focus-within, ...)`, the opposite of their names.
 */
const pseudoProps = new Map<string, string>();
for (const [name, selector] of Object.entries(conditions)) {
  if (typeof selector !== "string" || selector.includes(":not(:focus-within")) continue;
  const key = normalize(selector);
  if (!pseudoProps.has(key)) pseudoProps.set(key, name);
}

export const noRawSelector = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow writing a selector that Yamada UI has a pseudo prop for.",
    },
    messages: {
      raw: "`{{selector}}` は Yamada UI の `{{prop}}` で書く。擬似 props がないセレクタだけを css に書く。",
    },
  },
  create(context) {
    return {
      Property(property) {
        const { key } = property;
        if (key.type !== "Literal" || typeof key.value !== "string") return;
        const prop = pseudoProps.get(normalize(key.value));
        if (prop) {
          context.report({ node: key, messageId: "raw", data: { selector: key.value, prop } });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "yamada" },
  rules: { "no-conditional-style": noConditionalStyle, "no-raw-selector": noRawSelector },
});
