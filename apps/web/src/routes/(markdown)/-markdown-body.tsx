import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import { useRouteContext } from "@tanstack/react-router";
import { Box, Heading, Link, Text } from "@workspaces/ui";

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
} satisfies MarkdownComponents;

/**
 * A heading's id is its text, so the Markdown links to a section by its name
 * (`[免責事項](#免責事項)`).
 */
export const headingIds = (text: string) => text;

/** The Markdown that the route put in its context, as the page's content. */
export function MarkdownBody() {
  const markdown = useRouteContext({ strict: false, select: (context) => context.markdown });
  return (
    <Markdown components={components} headingIds={headingIds}>
      {markdown ?? ""}
    </Markdown>
  );
}
