import {
  ArrowRightIcon,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  List,
  Text,
  VStack,
} from "@workspaces/ui";
import { type ReactNode, useId } from "react";
import { ResultCard } from "./result-card.tsx";

/** That a plan could not be saved; next to the button that started it. */
export function SaveFailed() {
  return (
    <Text role="alert" fontSize="sm" color="danger.fg">
      プランを作れませんでした。もう一度お試しください。
    </Text>
  );
}

/** The sample's points by group: they add up to its total. */
const sampleTotals = { base: 868, spu: 1060, marathon: 2218, campaign: 674 };

/** A fixed result, so a visitor sees what the tool answers; it is not computed. */
export function SampleCard() {
  return (
    <ResultCard
      hidden
      label={
        <Badge colorScheme="mono" variant="solid" rounded="full">
          計算結果の見本
        </Badge>
      }
      title="11月 お買い物マラソン"
      meta="11/4〜11/11・8店舗・12件"
      total={4820}
      capRemaining={2180}
      totals={sampleTotals}
      shopCount={8}
      nextShopRate={1}
    />
  );
}

/**
 * The catch's size beside the sample: its first line, ten characters, fills the column at most.
 */
const CATCH_SIZE = "min({fontSizes.6xl}, 4.2vw, calc((96vw - 528px) / 10.4))";

const steps = ["イベントを選ぶ", "買うものを入れる", "ポイントと残りがわかる"];

/**
 * The three steps of using the tool on one line, or one under another where the column holding
 * them is too narrow for the line; the help has them in full.
 */
function StepLine() {
  return (
    <List.Root
      as="ol"
      display="flex"
      flexDirection="row"
      flexWrap="wrap"
      alignItems="center"
      rowGap="1"
      columnGap="2"
      fontSize="sm"
      fontWeight="bold"
      _container={[
        {
          maxInlineSize: "520px",
          css: {
            flexDirection: "column",
            alignItems: "flex-start",
            // The arrows go on lines of their own, each where the first one is: in the middle of
            // the second step, its number (24px), the gap (8px) and its eight characters.
            "& > li": { flexWrap: "wrap", rowGap: "1" },
            "& [data-step-arrow]": {
              flexBasis: "100%",
              boxSizing: "border-box",
              paddingInlineEnd: "calc(100% - 32px - 8em)",
              justifyContent: "center",
            },
            "& [data-step-arrow] svg": { transform: "rotate(90deg)" },
          },
        },
      ]}
    >
      {steps.map((step, index) => (
        <List.Item key={step} display="flex" alignItems="center" gap="2">
          {index > 0 ? (
            <Box as="span" aria-hidden data-step-arrow display="flex" color="fg.subtle">
              <ArrowRightIcon fontSize="md" />
            </Box>
          ) : null}
          <Box
            aria-hidden
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxSize="6"
            rounded="full"
            bg="primary"
            color="primary.contrast"
            // The digit sits low in its line box; trimmed to its cap height, it centers in the circle.
            css={{ textBoxTrim: "trim-both", textBoxEdge: "cap alphabetic" }}
          >
            {index + 1}
          </Box>
          {step}
        </List.Item>
      ))}
    </List.Root>
  );
}

/**
 * The top page's first screen: what the tool is, how to start, and beside them `aside` (the sample,
 * or the visitor's plans). On a wide screen it grows to the height the page leaves it and keeps its
 * content in the middle. `failed` shows that the plan its button started could not be saved.
 */
export function Hero({
  onStart,
  disabled,
  failed,
  aside,
}: {
  onStart: () => void;
  disabled: boolean;
  failed: boolean;
  aside: ReactNode;
}) {
  const headingId = useId();
  return (
    <Box
      as="section"
      aria-labelledby={headingId}
      bg="bg.panel"
      borderBottomWidth="1px"
      flex={{ base: "1", md: "none" }}
      display="flex"
      alignItems="center"
    >
      {/* Breakpoints here apply from that width down: two columns, which narrow with the screen,
          and one on a tablet or a phone, where the sample comes between the heading and the
          button. A property is given no value at both xl and lg: Yamada UI may write the xl one
          after the lg one, which then never applies. */}
      <Grid
        w="full"
        maxW={{ base: "1280px", lg: "672px", md: "full" }}
        mx="auto"
        px={{ base: "6", md: "5" }}
        pt={{ base: "10", md: "6" }}
        pb={{ base: "10", md: "7" }}
        gridTemplateColumns={{
          // The sample keeps 480px at least, where it would crowd its numbers; the heading gives way.
          base: "minmax(0, 1fr) clamp(480px, 36vw, 520px)",
          lg: "minmax(0, 1fr)",
        }}
        gridTemplateAreas={{
          base: `"head aside" "actions aside"`,
          lg: `"head" "aside" "actions"`,
        }}
        alignContent="center"
        columnGap="clamp({spaces.8}, 4vw, {spaces.16})"
        rowGap={{ base: "9", md: "6" }}
      >
        <VStack gridArea="head" alignSelf="end" alignItems="stretch" gap={{ base: "3", md: "1.5" }}>
          <Heading as="h1" id={headingId} fontSize={{ base: "sm", md: "xs" }} color="brand">
            楽天お買い物マラソンのポイント計算ツール
          </Heading>
          <Text
            fontSize={{
              base: CATCH_SIZE,
              lg: "5xl",
              md: "3xl",
            }}
            fontWeight="black"
            lineHeight="1.2"
          >
            何店舗・いくら
            <Box as="br" display={{ base: "none", md: "inline" }} />
            買えば
            <Box as="br" display={{ base: "inline", md: "none" }} />
            上限に届くか、
            <br />
            <Text as="span" color="brand">
              買う前にわかる
            </Text>
          </Text>
        </VStack>
        <Box gridArea="aside" alignSelf="center" minW="0">
          {aside}
        </Box>
        <VStack gridArea="actions" alignSelf="start" alignItems="stretch" gap="0">
          {/* Beside the sample, under the middle of the catch's first line, which is as wide as the
              column on a narrow screen and narrower on a wide one; as wide as the column where the
              sample is above it. */}
          <Flex
            direction="column"
            align={{ base: "center", lg: "stretch" }}
            maxW={{ base: `calc(${CATCH_SIZE} * 10)`, lg: "none" }}
          >
            <Button
              colorScheme="primary"
              size="xl"
              // The one button the page asks a visitor to press.
              minW={{ base: "18rem", lg: "auto" }}
              disabled={disabled}
              onClick={onStart}
            >
              計算をはじめる
            </Button>
          </Flex>
          {failed ? (
            <Box mt="3">
              <SaveFailed />
            </Box>
          ) : null}
          <VStack
            display={{ base: "flex", md: "none" }}
            mt="8"
            gap="3"
            alignItems="stretch"
            containerType="inline-size"
          >
            <StepLine />
            <Text fontSize="sm" color="fg.muted">
              無料・登録不要・入力はこのブラウザに保存
            </Text>
          </VStack>
        </VStack>
      </Grid>
    </Box>
  );
}
