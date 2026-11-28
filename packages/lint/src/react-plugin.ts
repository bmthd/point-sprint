import { definePlugin, defineRule, type Context, type ESTree } from "@oxlint/plugins";

function isEffectHook(name: string) {
  return name !== "useEffectEvent" && /^use\w*Effect$/.test(name);
}

function literalName(node: ESTree.Node) {
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? "";
  }
  return "";
}

function staticName(node: ESTree.Node) {
  return node.type === "Identifier" ? node.name : literalName(node);
}

function isHookSource(node: ESTree.Node) {
  const source = literalName(node);
  return source === "react" || source === "@workspaces/ui";
}

function checkDestructuring(context: Context, pattern: ESTree.ObjectPattern) {
  for (const property of pattern.properties) {
    if (property.type === "RestElement") {
      context.report({ node: property, messageId: "namespaceEscape" });
      continue;
    }
    const name = property.computed ? literalName(property.key) : staticName(property.key);
    if (!name) {
      context.report({ node: property, messageId: "namespaceEscape" });
    } else if (isEffectHook(name)) {
      context.report({ node: property, messageId: "effectHook", data: { name } });
    }
  }
}

function checkNamespace(context: Context, specifier: ESTree.ImportDeclarationSpecifier) {
  for (const variable of context.sourceCode.getDeclaredVariables(specifier)) {
    for (const reference of variable.references) {
      const identifier = reference.identifier;
      const parent = identifier.parent;
      // JSX also marks the import's binding identifier as a synthetic reference.
      if (identifier === specifier.local) continue;
      if (
        parent.type === "JSXMemberExpression" ||
        parent.type === "TSQualifiedName" ||
        parent.type === "TSTypeQuery"
      )
        continue;

      if (parent.type === "MemberExpression" && parent.object === identifier) {
        const name = parent.computed ? literalName(parent.property) : staticName(parent.property);
        if (!name) {
          context.report({ node: parent, messageId: "namespaceEscape" });
        } else if (isEffectHook(name)) {
          context.report({ node: parent, messageId: "effectHook", data: { name } });
        }
      } else if (
        parent.type === "VariableDeclarator" &&
        parent.init === identifier &&
        parent.id.type === "ObjectPattern"
      ) {
        checkDestructuring(context, parent.id);
      } else {
        context.report({ node: identifier, messageId: "namespaceEscape" });
      }
    }
  }
}

export const noEffectHooks = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow effect hooks from React and the UI package in application code.",
    },
    messages: {
      effectHook:
        "`{{name}}`: アプリのコードでは effect hooks を使わない。イベントハンドラー、ref callback、useSyncExternalStore、atom、loader で処理する。",
      namespaceEscape:
        "react の名前空間をそのまま渡すと effect hooks の禁止を確かめられない。使う hook を名前で取り出す。",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || !isHookSource(node.source)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            if (specifier.importKind === "type") continue;
            const name = staticName(specifier.imported);
            if (isEffectHook(name)) {
              context.report({ node: specifier, messageId: "effectHook", data: { name } });
            } else if (name === "default") {
              checkNamespace(context, specifier);
            }
          } else {
            checkNamespace(context, specifier);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === "type" || !node.source || !isHookSource(node.source)) return;
        for (const specifier of node.specifiers) {
          const name = staticName(specifier.local);
          if (specifier.exportKind !== "type" && isEffectHook(name)) {
            context.report({ node: specifier, messageId: "effectHook", data: { name } });
          }
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== "type" && isHookSource(node.source)) {
          context.report({ node, messageId: "namespaceEscape" });
        }
      },
      ImportExpression(node) {
        if (isHookSource(node.source)) {
          context.report({ node, messageId: "namespaceEscape" });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "react-app" },
  rules: { "no-effect-hooks": noEffectHooks },
});
