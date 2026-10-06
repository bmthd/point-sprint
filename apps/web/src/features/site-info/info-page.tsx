import { Box, Card, Heading, Text, VStack } from "@workspaces/ui";
import type { ReactNode } from "react";

/** The frame of a page that only has text to read: 利用規約, 使い方・注意事項, お知らせ. */
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <Heading as="h1" fontSize="lg" mb="4">
        {title}
      </Heading>
      <VStack gap="5" alignItems="stretch">
        {children}
      </VStack>
    </Box>
  );
}

/** A card with a heading and its paragraphs. `id` makes it a target of the page's table of contents. */
export function InfoSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <Card.Root as="section" id={id} aria-labelledby={titleId}>
      <Card.Body alignItems="stretch" gap="2">
        <Text as="h2" id={titleId} fontSize="md" fontWeight="bold">
          {title}
        </Text>
        {children}
      </Card.Body>
    </Card.Root>
  );
}

/** The paragraphs of a section, one `<p>` each. */
export function Paragraphs({ lines }: { lines: readonly string[] }) {
  return lines.map((line) => <Text key={line}>{line}</Text>);
}
