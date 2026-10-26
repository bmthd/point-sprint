import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import { useRouteContext } from "@tanstack/react-router";
import {
  Alert,
  type AlertRootProps,
  Box,
  Button,
  Card,
  Center,
  Heading,
  Image,
  Link,
  List,
  Mark,
  Modal,
  NativeAccordion,
  NativeTable,
  Text,
  Timeline,
  useDisclosure,
} from "@workspaces/ui";
import type { ReactNode } from "react";
import type { FileRoutesById } from "../../../routeTree.gen";
import { markdownExtensions } from "./-markdown-extensions";
import { ColumnHead } from "../../../ui/column-head";

/**
 * A box inside the page's card, as the steps and the lists of items are: sunk a step on a light
 * gray face, without the card's own shadow or line, so it reads as part of the page.
 */
export const insetCardProps = {
  bg: "bg.subtle",
  borderColor: "transparent",
  boxShadow: "none",
  _dark: { borderColor: "transparent" },
} as const;

/** The Markdown's tags, drawn with Yamada UI to match the other pages. */
/**
 * A screenshot that fits the column and a set height, centered and framed like a card, and loads
 * only near the viewport. Pressed, it opens over the page at the size the window allows.
 */
function ScreenshotImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  const { open, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Box
        as="button"
        type="button"
        aria-label={`${alt ?? "画像"}を拡大する`}
        onClick={onOpen}
        display="block"
        mx="auto"
        cursor="zoom-in"
      >
        <Image
          src={src}
          alt={alt}
          title={title}
          loading="lazy"
          decoding="async"
          display="block"
          maxW="full"
          maxH="480px"
          w="auto"
          h="auto"
          rounded="xl"
          borderWidth="1px"
          borderColor="border"
        />
      </Box>
      <Modal.Root open={open} onClose={onClose} size="cover">
        {/* The content covers the window, so pressing anywhere on it, image or not, closes it. */}
        <Modal.Content
          bg="transparent"
          borderWidth="0"
          boxShadow="none"
          cursor="zoom-out"
          onClick={onClose}
        >
          <Modal.CloseButton />
          <Modal.Body p="0" display="flex" justifyContent="center" alignItems="center">
            <Image
              src={src}
              alt={alt}
              maxW="full"
              maxH="calc(100dvh - 6rem)"
              w="auto"
              h="auto"
              rounded="xl"
            />
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}

export const markdownComponents = {
  h1: ({ children, id }) => (
    <ColumnHead mb="2.5">
      <Heading as="h1" id={id} fontSize="lg">
        {children}
      </Heading>
    </ColumnHead>
  ),
  h2: ({ children, id }) => (
    <Heading as="h2" id={id} fontSize="md" mt="8" mb="2">
      {children}
    </Heading>
  ),
  p: ({ children }) => (
    <Text my="lg" lineHeight="1.9">
      {children}
    </Text>
  ),
  a: ({ children, href }) => (
    <Link href={href} color="link">
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <List.Root styleType="disc" my="lg" lineHeight="1.9">
      {children}
    </List.Root>
  ),
  ol: ({ children }) => (
    <List.Root styleType="decimal" my="lg" lineHeight="1.9">
      {children}
    </List.Root>
  ),
  li: ({ children }) => <List.Item>{children}</List.Item>,
  // A table's numbers line up by digit; a column's alignment comes from the Markdown (`--:`).
  table: ({ children }) => (
    <NativeTable.Root my="lg" fontVariantNumeric="tabular-nums">
      {children}
    </NativeTable.Root>
  ),
  thead: ({ children }) => <NativeTable.Thead>{children}</NativeTable.Thead>,
  tbody: ({ children }) => <NativeTable.Tbody>{children}</NativeTable.Tbody>,
  tr: ({ children }) => <NativeTable.Tr>{children}</NativeTable.Tr>,
  th: ({ children, style }) => <NativeTable.Th style={style}>{children}</NativeTable.Th>,
  td: ({ children, style }) => <NativeTable.Td style={style}>{children}</NativeTable.Td>,
  // What the text wants read is marked like a highlighter, not bolded; a long one still wraps.
  strong: ({ children }) => (
    <Mark as="strong" colorScheme="warning" whiteSpace="normal">
      {children}
    </Mark>
  ),
  img: ({ src, alt, title }) => <ScreenshotImage src={src} alt={alt} title={title} />,
  "md-details": ({ summary, children }: { summary: string; children?: ReactNode }) => (
    <NativeAccordion.Root borderBottomWidth="1px" borderColor="border">
      <NativeAccordion.Item>
        <NativeAccordion.Button fontWeight="bold">{summary}</NativeAccordion.Button>
        <NativeAccordion.Panel>{children}</NativeAccordion.Panel>
      </NativeAccordion.Item>
    </NativeAccordion.Root>
  ),
  "md-alert": ({
    status,
    variant,
    children,
  }: Pick<AlertRootProps, "status" | "variant"> & { children?: ReactNode }) => (
    <Alert.Root status={status} variant={variant} my="lg" alignItems="flex-start" py="4">
      <Alert.Icon boxSize="7" />
      <Alert.Description css={{ "& > :first-child": { mt: 0 }, "& > :last-child": { mb: 0 } }}>
        {children}
      </Alert.Description>
    </Alert.Root>
  ),
  "md-button": ({ href, label }: { href: string; label: string }) => (
    <Center my="lg">
      <Button as="a" href={href} colorScheme="primary" size="lg">
        {label}
      </Button>
    </Center>
  ),
  "md-timeline": ({ children }: { children?: ReactNode }) => (
    <Card.Root my="4" {...insetCardProps}>
      <Card.Body>
        <Timeline.Root variant="number" colorScheme="mono" size="lg">
          {children}
        </Timeline.Root>
      </Card.Body>
    </Card.Root>
  ),
  "md-timeline-step": ({ step, children }: { step: string; children?: ReactNode }) => (
    <Timeline.Item>
      <Timeline.Connector>
        <Timeline.Indicator>{step}</Timeline.Indicator>
      </Timeline.Connector>
      <Timeline.Content css={{ "& > p": { margin: 0 } }}>{children}</Timeline.Content>
    </Timeline.Item>
  ),
} satisfies MarkdownComponents;

/**
 * A heading's id is its text, so the Markdown links to a section by its name
 * (`[免責事項](#免責事項)`).
 */
export const headingIds = (text: string) => text;

/**
 * The routes under `(markdown)` that show their Markdown with `MarkdownBody`. The shopping guides
 * load theirs from `src/guides/articles/` and draw it with `GuideArticle`.
 */
type MarkdownRouteId = Exclude<
  Extract<keyof FileRoutesById, `/(markdown)/${string}`>,
  `/(markdown)/guides/${string}`
>;

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
    <Markdown
      components={markdownComponents}
      extensions={markdownExtensions}
      headingIds={headingIds}
    >
      {markdown}
    </Markdown>
  );
}
