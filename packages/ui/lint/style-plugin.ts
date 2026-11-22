import { definePlugin, defineRule } from "@oxlint/plugins";
import { styleProperties } from "@yamada-ui/react/core";

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

export default definePlugin({
  meta: { name: "yamada" },
  rules: { "no-conditional-style": noConditionalStyle },
});
