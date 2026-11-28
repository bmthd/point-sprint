import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { noEffectHooks } from "./react-plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } },
});

const effect = (name: string) => ({ messageId: "effectHook", data: { name } });
const escape = { messageId: "namespaceEscape" };

tester.run("no-effect-hooks", noEffectHooks, {
  valid: [
    {
      name: "ordinary hooks",
      code: 'import { useState, useMemo, useCallback, useSyncExternalStore } from "react";',
    },
    { name: "named effect event", code: 'import { useEffectEvent } from "react";' },
    {
      name: "effect event member",
      code: 'import React from "react"; React.useEffectEvent(() => {});',
    },
    {
      name: "computed effect event",
      code: 'import * as R from "react"; R["useEffectEvent"](() => {});',
    },
    { name: "effect event re-export", code: 'export { useEffectEvent } from "react";' },
    {
      name: "fragment JSX",
      code: 'import React from "react"; const fragment = <React.Fragment />;',
    },
    { name: "React type", code: 'import React from "react"; type Node = React.ReactNode;' },
    {
      name: "namespace type query",
      code: 'import * as React from "react"; type Module = typeof React;',
    },
    { name: "type-only callback", code: 'import type { EffectCallback } from "react";' },
    { name: "type-only named hook", code: 'import type { useEffect } from "react";' },
    {
      name: "type-only namespace",
      code: 'import type React from "react"; type Hook = typeof React.useEffect;',
    },
    { name: "inline type import", code: 'import { type useEffect } from "react";' },
    { name: "inline type export", code: 'export { type useEffect } from "react";' },
    { name: "type re-export", code: 'export type { useEffect } from "react";' },
    { name: "type export all", code: 'export type * from "react";' },
    { name: "local React object", code: "const React = { useEffect() {} }; React.useEffect();" },
    { name: "local hook function", code: "function useEffect() {} useEffect();" },
    { name: "another library", code: 'import { useEffect } from "some-other-lib"; useEffect();' },
    { name: "local hook module", code: 'import { useUpdateEffect } from "./local.ts";' },
    { name: "react-dom source", code: 'import React from "react-dom"; React.useEffect();' },
    { name: "Yamada source", code: 'import { useUpdateEffect } from "@yamada-ui/react";' },
    { name: "another export all source", code: 'export * from "some-other-lib";' },
    { name: "another dynamic import", code: 'import("some-other-lib");' },
    {
      name: "shadowed React parameter",
      code: 'import React from "react"; function example(React) { React.useEffect(); }',
    },
    {
      name: "shadowed UI parameter",
      code: 'import * as UI from "@workspaces/ui"; function example(UI) { UI.useUpdateEffect(); }',
    },
    { name: "ordinary UI hook", code: 'import { useCallbackRef } from "@workspaces/ui";' },
  ],
  invalid: [
    ...["react", "@workspaces/ui"].flatMap((source) =>
      [
        "useEffect",
        "useLayoutEffect",
        "useInsertionEffect",
        "useUpdateEffect",
        "useSafeLayoutEffect",
        "useFutureEffect",
      ].flatMap((hook) => [
        {
          name: `${source} named ${hook}`,
          code: `import { ${hook} } from "${source}";`,
          errors: [effect(hook)],
        },
        {
          name: `${source} aliased ${hook}`,
          code: `import { ${hook} as run } from "${source}"; run(); run();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} default member ${hook}`,
          code: `import React from "${source}"; React.${hook}();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} namespace member ${hook}`,
          code: `import * as R from "${source}"; R.${hook};`,
          errors: [effect(hook)],
        },
        {
          name: `${source} named default ${hook}`,
          code: `import { default as React } from "${source}"; React.${hook}();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} mixed default ${hook}`,
          code: `import React, { useState } from "${source}"; React.${hook}();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} optional member ${hook}`,
          code: `import React from "${source}"; React?.${hook}?.();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} computed member ${hook}`,
          code: `import React from "${source}"; React["${hook}"]();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} template member ${hook}`,
          code: `import React from "${source}"; React[\`${hook}\`]();`,
          errors: [effect(hook)],
        },
        {
          name: `${source} destructured ${hook}`,
          code: `import React from "${source}"; const { ${hook} } = React;`,
          errors: [effect(hook)],
        },
        {
          name: `${source} destructured alias ${hook}`,
          code: `import * as UI from "${source}"; const { ${hook}: x } = UI;`,
          errors: [effect(hook)],
        },
        {
          name: `${source} re-export ${hook}`,
          code: `export { ${hook} } from "${source}";`,
          errors: [effect(hook)],
        },
        {
          name: `${source} aliased re-export ${hook}`,
          code: `export { ${hook} as x } from "${source}";`,
          errors: [effect(hook)],
        },
      ]),
    ),
    ...["react", "@workspaces/ui"].flatMap((source) => [
      {
        name: `${source} dynamic key`,
        code: `import React from "${source}"; React[name];`,
        errors: [escape],
      },
      {
        name: `${source} dynamic template`,
        code: `import React from "${source}"; React[\`use\${name}Effect\`];`,
        errors: [escape],
      },
      {
        name: `${source} namespace alias`,
        code: `import React from "${source}"; const R = React; R.useEffect();`,
        errors: [escape],
      },
      {
        name: `${source} namespace argument`,
        code: `import * as R from "${source}"; consume(R);`,
        errors: [escape],
      },
      {
        name: `${source} namespace spread`,
        code: `import * as R from "${source}"; const copy = { ...R };`,
        errors: [escape],
      },
      { name: `${source} export all`, code: `export * from "${source}";`, errors: [escape] },
      {
        name: `${source} export namespace`,
        code: `export * as React from "${source}";`,
        errors: [escape],
      },
      { name: `${source} dynamic import`, code: `import("${source}");`, errors: [escape] },
    ]),
    {
      name: "multiple member accesses",
      code: 'import React from "react"; React.useEffect(); React.useLayoutEffect();',
      errors: [effect("useEffect"), effect("useLayoutEffect")],
    },
    {
      name: "nested namespace reference",
      code: 'import React from "react"; function example() { React.useEffect(); }',
      errors: [effect("useEffect")],
    },
    {
      name: "shadowed and imported references",
      code: 'import React from "react"; function example(React) { React.useEffect(); } React.useEffect();',
      errors: [effect("useEffect")],
    },
  ],
});
