import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { noConditionalStyle } from "./style-plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } },
});

const error = (name: string) => ({ messageId: "conditional", data: { name } });

tester.run("no-conditional-style", noConditionalStyle, {
  valid: [
    {
      name: "a fixed value",
      code: `<Box bg="bg.subtle" />`,
    },
    {
      name: "the state is an attribute, and css reads it",
      code: `<Box data-held={dataAttr(held)} css={{ "&[data-held]": { bg: "bg.subtle" } }} />`,
    },
    {
      name: "a value worked out elsewhere",
      code: `<Box w={width} />`,
    },
    {
      name: "a prop that is not a style",
      code: `<Box aria-current={current ? "true" : undefined} as={held ? "s" : "span"} />`,
    },
    {
      name: "a component's variant and size",
      code: `<Button variant={editing ? "subtle" : "ghost"} size={small ? "sm" : "md"} />`,
    },
    {
      name: "a condition inside a function the prop is given",
      code: `<Box css={(theme) => (theme.dark ? dark : light)} />`,
    },
  ],
  invalid: [
    {
      name: "a style prop chosen by a ternary",
      code: `<Box bg={held ? "bg.subtle" : undefined} />`,
      errors: [error("bg")],
    },
    {
      name: "a style prop chosen by &&, || or ??",
      code: `<>
        <Box opacity={held && 0.4} />
        <Box color={tone || "fg"} />
        <Box fontSize={size ?? "sm"} />
      </>`,
      errors: [error("opacity"), error("color"), error("fontSize")],
    },
    {
      name: "colorScheme chosen by state",
      code: `<Progress colorScheme={full ? "success" : "gray"} />`,
      errors: [error("colorScheme")],
    },
    {
      name: "a condition in a template literal",
      code: "<Box flex={`1 0 ${large ? '9rem' : '8rem'}`} />",
      errors: [error("flex")],
    },
    {
      name: "a condition in a responsive object",
      code: `<Box flex={{ base: "initial", md: many ? "0 0 88%" : "1 0 100%" }} />`,
      errors: [error("flex")],
    },
    {
      name: "a condition nested in css",
      code: `<Box css={{ "& > li": { color: held ? "fg.muted" : "fg" } }} />`,
      errors: [error("css")],
    },
    {
      name: "css chosen as a whole",
      code: `<Box css={compact ? folding : undefined} />`,
      errors: [error("css")],
    },
    {
      name: "a pseudo prop",
      code: `<Box _hover={{ bg: active ? "bg.muted" : "bg.subtle" }} />`,
      errors: [error("_hover")],
    },
  ],
});
