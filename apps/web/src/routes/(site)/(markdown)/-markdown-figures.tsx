import { Box, Card, DataList, Flex, Heading, SimpleGrid, Text } from "@workspaces/ui";
import { Children, type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";
import { amountIn } from "./-markdown-extensions";

type CellProps = { label: string; empty?: string; children?: ReactNode };

/** The cells of a row, as the elements `md-cell` draws. */
const cellsOf = (children: ReactNode) =>
  Children.toArray(children).filter(isValidElement) as ReactElement<CellProps>[];

/**
 * The fills of a figure's parts in order: those of the point groups (通常, SPU, マラソン, キャンペーン),
 * so a part is told apart by lightness and the fourth by its stripes, never by color alone.
 */
const FILLS = [
  "point",
  "point.spu",
  "point.marathon",
  "repeating-linear-gradient(45deg, {colors.point.campaign} 0 3px, {colors.bg.panel} 3px 6px)",
];
const fillOf = (index: number) => FILLS[index % FILLS.length];

const numbers = (json: string) => JSON.parse(json) as number[];

const tabular = { fontVariantNumeric: "tabular-nums" } as const;

function Swatch({ index }: { index: string }) {
  return <Box boxSize="3" rounded="xs" flex="none" bg={fillOf(Number(index))} aria-hidden />;
}

/** The parts of a figure drawn to scale on one bar; `of` is the whole, or their sum. */
function ScaleBar({ amounts, of }: { amounts: number[]; of?: number }) {
  const whole = of ?? amounts.reduce((sum, amount) => sum + amount, 0);
  return (
    <Flex w="full" h="7" rounded="md" overflow="hidden" gap="0.5" bg="bg.muted" aria-hidden>
      {amounts.map((amount, index) => (
        <Box key={index} w={`${(amount / whole) * 100}%`} bg={fillOf(index)} />
      ))}
    </Flex>
  );
}

/** A row of a figure: its swatch, its name and note, and its value at the end. */
function LegendRow({ index, children }: { index: string; children?: ReactNode }) {
  const [name, ...rest] = cellsOf(children);
  const value = rest.pop();
  return (
    <Flex
      as="li"
      align="center"
      gap="3"
      py="2"
      borderTopWidth="1px"
      borderColor="border"
      _first={{ borderTopWidth: 0 }}
    >
      <Swatch index={index} />
      <Box flex="1" minW="0" lineHeight="1.5">
        <Box fontWeight="medium">{name}</Box>
        {rest.map((note, at) => (
          <Box key={at} fontSize="xs" color="fg.muted">
            {note}
          </Box>
        ))}
      </Box>
      <Box fontWeight="bold" {...tabular}>
        {value}
      </Box>
    </Flex>
  );
}

/** The argument `合計 205P` as its label and its value. */
const splitTotal = (argument: string) => {
  const at = argument.lastIndexOf(" ");
  return at === -1 ? ["", argument] : [argument.slice(0, at), argument.slice(at + 1)];
};

/** The steps of `:::flow`, numbered: across the column on a wide screen, down it on a phone. */
function Flow({ children }: { children?: ReactNode }) {
  const count = Children.count(children);
  return (
    <Box
      as="ol"
      listStyleType="none"
      my="lg"
      display="grid"
      gridTemplateColumns={{ base: `repeat(${count}, minmax(0, 1fr))`, md: "1fr" }}
      {...tabular}
    >
      {Children.map(children, (step, at) =>
        isValidElement<{ last?: boolean }>(step)
          ? cloneElement(step, { last: at === count - 1 })
          : step,
      )}
    </Box>
  );
}

function FlowStep({
  index,
  last,
  children,
}: {
  index: string;
  /** Set by `Flow` on the final step, which has no line to a next one. */
  last?: boolean;
  children?: ReactNode;
}) {
  const [title, value, note] = cellsOf(children);
  return (
    <Box
      as="li"
      position="relative"
      display="grid"
      gridTemplateAreas={{
        base: `"dot" "title" "value" "note"`,
        md: `"dot title value" "dot note note"`,
      }}
      gridTemplateColumns={{ base: "1fr", md: "auto 1fr auto" }}
      gridTemplateRows={{ md: "auto 1fr" }}
      justifyItems={{ base: "center", md: "start" }}
      alignContent="start"
      textAlign={{ base: "center", md: "left" }}
      columnGap="3"
      px={{ base: "1", md: "0" }}
      pb={{ md: "5" }}
    >
      {/* The line to the next step, behind the numbers: across on a wide screen, down on a phone. */}
      {last ? null : (
        <>
          <Box
            aria-hidden
            display={{ base: "block", md: "none" }}
            position="absolute"
            bg="border"
            top="4"
            left="calc(50% + 1rem)"
            right="calc(-50% + 1rem)"
            h="2px"
          />
          <Box
            aria-hidden
            display={{ base: "none", md: "block" }}
            position="absolute"
            bg="border"
            top="8"
            bottom="0"
            left="calc(1rem - 1px)"
            w="2px"
          />
        </>
      )}
      <Flex
        gridArea="dot"
        boxSize="8"
        rounded="full"
        bg="primary.solid"
        color="primary.contrast"
        fontWeight="bold"
        fontSize="sm"
        align="center"
        justify="center"
        position="relative"
        mb={{ base: "1.5", md: "0" }}
      >
        {Number(index) + 1}
      </Flex>
      <Box gridArea="title" fontWeight="bold" fontSize="sm" lineHeight="1.4" alignSelf="center">
        {title}
      </Box>
      <Box
        gridArea="value"
        fontWeight="bold"
        color="primary.fg"
        mt={{ base: "1", md: "0" }}
        alignSelf="center"
      >
        {value}
      </Box>
      <Box gridArea="note" fontSize="xs" color="fg.muted" lineHeight="1.6" mt="1">
        {note}
      </Box>
    </Box>
  );
}

/** `:::breakdown`: the values as one bar to scale, each row, and the total. */
function Breakdown({
  argument,
  amounts,
  children,
}: {
  argument: string;
  amounts: string;
  children?: ReactNode;
}) {
  const [label, total] = splitTotal(argument);
  return (
    <Card.Root my="lg">
      <Card.Body gap="3">
        <ScaleBar amounts={numbers(amounts)} />
        <Box as="ul" listStyleType="none" w="full">
          {children}
        </Box>
        {total ? (
          <Flex
            w="full"
            justify="space-between"
            align="baseline"
            borderTopWidth="1px"
            borderColor="border"
            pt="2"
          >
            <Text fontWeight="bold">{label}</Text>
            <Text fontWeight="bold" fontSize="xl" color="primary.fg" {...tabular}>
              {total}
            </Text>
          </Flex>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

/** `:::meter`: the values filling a bar up to the argument's number, then each row. */
function Meter({
  argument,
  amounts,
  children,
}: {
  argument: string;
  amounts: string;
  children?: ReactNode;
}) {
  return (
    <Card.Root my="lg">
      <Card.Body gap="1.5">
        <ScaleBar amounts={numbers(amounts)} of={amountIn(argument)} />
        <Flex w="full" justify="space-between" fontSize="xs" color="fg.muted" {...tabular}>
          <span>0</span>
          <span>{argument}</span>
        </Flex>
        <Box as="ul" listStyleType="none" w="full">
          {children}
        </Box>
      </Card.Body>
    </Card.Root>
  );
}

/** `:::cards`: a card for each row, its second column large and the others as notes under it. */
function Cards({ children }: { children?: ReactNode }) {
  return (
    <SimpleGrid as="ul" listStyleType="none" columns={{ base: 2, md: 1 }} gap="3" my="lg">
      {children}
    </SimpleGrid>
  );
}

function CardsRow({ children }: { children?: ReactNode }) {
  const [title, highlight, ...notes] = cellsOf(children);
  return (
    <Card.Root as="li" size="sm">
      <Card.Body gap="1" lineHeight="1.6">
        <Flex justify="space-between" align="baseline" gap="3" w="full">
          <Box fontWeight="bold">{title}</Box>
          {highlight && highlight.props.empty !== "true" ? (
            <Box fontWeight="bold" color="primary.fg" whiteSpace="nowrap" {...tabular}>
              {highlight}
            </Box>
          ) : null}
        </Flex>
        {notes
          .filter((note) => note.props.empty !== "true")
          .map((note, at) => (
            <Flex key={at} fontSize="xs" color="fg.muted" gap="1" {...tabular}>
              {note.props.label ? <Box flex="none">{note.props.label}:</Box> : null}
              <Box minW="0">{note}</Box>
            </Flex>
          ))}
      </Card.Body>
    </Card.Root>
  );
}

/** `:::compare`: the things compared side by side, each a card of what is compared. */
function Compare({ children }: { children?: ReactNode }) {
  return (
    <SimpleGrid columns={{ base: 2, md: 1 }} gap="3" my="lg" {...tabular}>
      {children}
    </SimpleGrid>
  );
}

function CompareItem({ title, children }: { title: string; children?: ReactNode }) {
  const cells = cellsOf(children);
  const result = cells.pop();
  return (
    <Card.Root>
      <Card.Body gap="2">
        <Heading as="h4" fontSize="sm">
          {title}
        </Heading>
        <DataList.Root size="sm" variant="grid" w="full">
          {cells.map((value, at) => (
            <DataList.Item key={at}>
              <DataList.Term>{value.props.label}</DataList.Term>
              <DataList.Description>{value}</DataList.Description>
            </DataList.Item>
          ))}
        </DataList.Root>
        {result ? (
          <Flex
            justify="space-between"
            align="baseline"
            w="full"
            borderTopWidth="1px"
            borderColor="border"
            pt="2"
          >
            <Text fontSize="sm" color="fg.muted">
              {result.props.label}
            </Text>
            <Box fontWeight="bold" fontSize="xl" color="primary.fg">
              {result}
            </Box>
          </Flex>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

/** A table cell's paragraph, without the paragraph's margins. */
function Cell({ children }: CellProps) {
  return (
    <Box
      css={{
        "& > p": { margin: 0, lineHeight: "inherit", fontSize: "inherit" },
        // A link stays in the line of the cell's text, so the date after a source does not wrap below it.
        "& a": { display: "inline" },
      }}
    >
      {children}
    </Box>
  );
}

/** The figures that `:::flow`, `:::breakdown`, `:::meter`, `:::cards` and `:::compare` become. */
export const figureComponents = {
  "md-cell": Cell,
  "md-flow": Flow,
  "md-flow-row": FlowStep,
  "md-breakdown": Breakdown,
  "md-breakdown-row": LegendRow,
  "md-meter": Meter,
  "md-meter-row": LegendRow,
  "md-cards": Cards,
  "md-cards-row": CardsRow,
  "md-compare": Compare,
  "md-compare-item": CompareItem,
};
