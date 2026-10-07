import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
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
 * A page written in Markdown: 利用規約, 使い方・注意事項. A heading's id is its text, so the
 * Markdown links to a section by its name (`[免責事項](#免責事項)`).
 */
export function MarkdownPage({ source }: { source: string }) {
  return (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <Markdown components={components} headingIds={(text) => text}>
        {source}
      </Markdown>
    </Box>
  );
}
