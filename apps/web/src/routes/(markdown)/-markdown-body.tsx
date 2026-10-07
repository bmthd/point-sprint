import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import { useRouteContext } from "@tanstack/react-router";
import { Badge, Box, Card, Heading, Link, NativeAccordion, Text } from "@workspaces/ui";
import type { ReactNode } from "react";
import type { FileRoutesById } from "../../routeTree.gen";
import { markdownExtensions } from "./-markdown-extensions";

/** The Markdown's tags, drawn with Yamada UI to match the other pages. */
const components = {
  h1: ({ children, id }) => (
    <Heading as="h1" id={id} fontSize="lg" mb="4">
      {children}
    </Heading>
  ),
  h2: ({ children, id }) => (
    <Text as="h2" id={id} fontSize="md" fontWeight="bold" mt="8" mb="2">
      {children}
    </Text>
  ),
  p: ({ children }) => <Text my="2">{children}</Text>,
  a: ({ children, href }) => <Link href={href}>{children}</Link>,
  ul: ({ children }) => (
    <Box as="ul" ps="6" my="2" listStyleType="disc">
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box as="ol" ps="6" my="2" listStyleType="decimal">
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Box as="li" my="1">
      {children}
    </Box>
  ),
  "md-details": ({ summary, children }: { summary: string; children?: ReactNode }) => (
    <NativeAccordion.Root animate={false} borderBottomWidth="1px" borderColor="border">
      <NativeAccordion.Item>
        <NativeAccordion.Button fontWeight="bold">{summary}</NativeAccordion.Button>
        <NativeAccordion.Panel>{children}</NativeAccordion.Panel>
      </NativeAccordion.Item>
    </NativeAccordion.Root>
  ),
  "md-timeline": ({ children }: { children?: ReactNode }) => (
    <Card.Root my="4">
      <Card.Body as="ol" gap="3" alignItems="stretch">
        {children}
      </Card.Body>
    </Card.Root>
  ),
  "md-timeline-step": ({ step, children }: { step: string; children?: ReactNode }) => (
    <Box as="li" display="grid" gridTemplateColumns="auto 1fr" gap="3" alignItems="start">
      <Badge variant="solid" colorScheme="mono" fullRounded mt="0.5" aria-hidden>
        {step}
      </Badge>
      <Box css={{ "& > p": { margin: 0 } }}>{children}</Box>
    </Box>
  ),
} satisfies MarkdownComponents;

/**
 * A heading's id is its text, so the Markdown links to a section by its name
 * (`[免責事項](#免責事項)`).
 */
export const headingIds = (text: string) => text;

type MarkdownRouteId = Extract<keyof FileRoutesById, `/(markdown)/${string}`>;

/** The routes under `(markdown)` whose context has no Markdown: `never` when there is none. */
type RoutesWithoutMarkdown = {
  [Id in MarkdownRouteId]: FileRoutesById[Id]["types"]["routeContext"] extends { markdown: string }
    ? never
    : Id;
}[MarkdownRouteId];

// A type error names the route that forgot `context: () => ({ markdown })`.
const everyRouteHasMarkdown: [RoutesWithoutMarkdown] extends [never]
  ? true
  : RoutesWithoutMarkdown = true;
void everyRouteHasMarkdown;

/** The Markdown that the route put in its context, as the page's content. */
export function MarkdownBody() {
  const markdown = useRouteContext({ strict: false, select: (context) => context.markdown });
  // Unreachable while `everyRouteHasMarkdown` type-checks.
  if (markdown === undefined) throw new Error("This route has no Markdown in its context.");
  return (
    <Markdown components={components} extensions={markdownExtensions} headingIds={headingIds}>
      {markdown}
    </Markdown>
  );
}
