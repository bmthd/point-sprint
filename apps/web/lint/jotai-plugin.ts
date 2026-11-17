import { definePlugin, defineRule, type Context, type ESTree } from "@oxlint/plugins";

type Node = ESTree.Node;
type Function = ESTree.Function | ESTree.ArrowFunctionExpression;

function isFunction(node: Node): node is Function {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function enclosingFunction(node: Node): Function | null {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current)) return current;
  }
  return null;
}

function contains(outer: Node, inner: Node) {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Whether the function draws JSX: a render prop or a component, which runs while rendering. */
function drawsJsx(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some(drawsJsx);
  const { type } = node as { type?: unknown };
  if (type === "JSXElement" || type === "JSXFragment") return true;
  return Object.entries(node).some(([key, value]) => key !== "parent" && drawsJsx(value));
}

/**
 * Whether the code at `node` runs only after rendering, inside a function that nothing calls while
 * `owner` renders. A function handed to a call (`items.map`, `useMemo`, `useCallback`) or called
 * right away counts as running while rendering, since the rule cannot tell when the callee runs it.
 */
function runsAfterRender(context: Context, node: Node, owner: Function, seen: Set<Node>): boolean {
  for (let current = node.parent; current && current !== owner; current = current.parent) {
    if (isFunction(current) && !isCalledWhileRendering(context, current, owner, seen)) return true;
  }
  return false;
}

function isCalledWhileRendering(
  context: Context,
  fn: Function,
  owner: Function,
  seen: Set<Node>,
): boolean {
  if (drawsJsx(fn.body)) return true;
  const { parent } = fn;
  if (parent.type === "CallExpression") return true;
  const binding =
    fn.type === "FunctionDeclaration"
      ? fn
      : parent.type === "VariableDeclarator" && parent.init === fn
        ? parent
        : null;
  if (!binding) return false;
  // A function that reaches itself again runs no earlier than its first call.
  if (seen.has(fn)) return false;
  seen.add(fn);
  return context.sourceCode
    .getDeclaredVariables(binding)
    .flatMap((variable) => variable.references)
    .some(
      (reference) =>
        reference.isRead() &&
        reference.identifier.parent.type === "CallExpression" &&
        !runsAfterRender(context, reference.identifier, owner, seen),
    );
}

/** The pattern that binds the atom's value: all of `useAtomValue`'s result, the first item of `useAtom`'s. */
function valuePattern(hook: string, id: ESTree.BindingPattern) {
  if (hook === "useAtomValue") return id;
  return id.type === "ArrayPattern" ? id.elements[0] : null;
}

export const noCallbackOnlySubscription = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow subscribing to an atom with useAtomValue or useAtom when only functions read the value.",
    },
    messages: {
      callbackOnly:
        "`{{hook}}` で購読した値を、関数の中でしか読んでいない。値が変わるたびに無駄に再描画する。書き込み専用の atom（`atom(null, (get) => { ... })`）の中で `get` して読み、部品では `useSetAtom` で呼ぶ。",
    },
  },
  create(context) {
    return {
      CallExpression(call) {
        if (call.callee.type !== "Identifier") return;
        const hook = call.callee.name;
        if (hook !== "useAtomValue" && hook !== "useAtom") return;
        const declarator = call.parent;
        if (declarator.type !== "VariableDeclarator" || declarator.init !== call) return;
        const pattern = valuePattern(hook, declarator.id);
        const owner = enclosingFunction(call);
        if (!pattern || !owner) return;

        const reads = context.sourceCode
          .getDeclaredVariables(declarator)
          .filter((variable) => variable.identifiers.some((id) => contains(pattern, id)))
          .flatMap((variable) => variable.references)
          .filter((reference) => reference.isRead());
        if (reads.length === 0) return;
        if (reads.every((read) => runsAfterRender(context, read.identifier, owner, new Set()))) {
          context.report({ node: call, messageId: "callbackOnly", data: { hook } });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "jotai" },
  rules: { "no-callback-only-subscription": noCallbackOnlySubscription },
});
