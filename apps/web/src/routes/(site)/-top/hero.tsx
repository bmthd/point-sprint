import { Badge, Box, Button, Card, Flex, Grid, Heading, List, Text, VStack } from "@workspaces/ui";
import { type ReactNode, useId } from "react";
import { RouterButton, RouterLink } from "../../../ui/router-link";
import { PointBreakdown } from "../../-point-breakdown";

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

/**
 * A fixed result, so a visitor sees what the tool answers; it is not computed. On a phone the
 * legend has the groups' names alone, and the shops are in the total's card.
 */
export function SampleCard() {
  return (
    <Card.Root aria-hidden shadow="lg" overflow="visible" position="relative">
      <Box position="absolute" top="-2.5" left="4">
        <Badge colorScheme="mono" variant="solid" rounded="full">
          計算結果の見本
        </Badge>
      </Box>
      <Card.Body gap={{ base: "4", md: "3" }} pt="6">
        <Card.Root variant="solid" colorScheme="primary">
          <Card.Body flexDirection="row" alignItems="flex-end" justifyContent="space-between">
            <VStack gap="1" alignItems="stretch">
              <Text fontSize="sm">獲得予定</Text>
              <Text
                fontSize={{ base: "5xl", md: "4xl" }}
                fontWeight="bold"
                lineHeight="1"
                fontVariantNumeric="tabular-nums"
              >
                4,820P
              </Text>
            </VStack>
            <Text fontSize="sm" textAlign="end" fontVariantNumeric="tabular-nums">
              <Box as="span" display={{ base: "none", md: "inline" }}>
                8 / 10 店舗
              </Box>
              <Box as="span" display={{ base: "inline", md: "none" }}>
                上限まで
              </Box>
              <br />
              <Text as="span" fontSize="lg" fontWeight="bold" whiteSpace="nowrap">
                あと 2,180P
              </Text>
            </Text>
          </Card.Body>
        </Card.Root>
        <Box display={{ base: "block", md: "none" }} w="full">
          <PointBreakdown totals={sampleTotals} />
        </Box>
        <Box display={{ base: "none", md: "block" }} w="full">
          <PointBreakdown totals={sampleTotals} legend="names" />
        </Box>
        <Flex display={{ base: "flex", md: "none" }} w="full" justify="space-between" fontSize="sm">
          <Text fontWeight="bold" fontVariantNumeric="tabular-nums">
            8 / 10 店舗
          </Text>
          <Text color="fg.muted">あと 2 店舗で +2倍</Text>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

const steps = ["イベントを選ぶ", "買うものを入れる", "ポイントと残りがわかる"];

/** The three steps of using the tool on one line; the help has them in full. */
function StepLine() {
  return (
    <List.Root
      as="ol"
      display="flex"
      flexDirection="row"
      flexWrap="wrap"
      alignItems="center"
      rowGap="1"
      columnGap="3"
      fontSize="sm"
      fontWeight="bold"
    >
      {steps.map((step, index) => (
        <List.Item
          key={step}
          display="flex"
          alignItems="center"
          gap="2"
          _notFirst={{ _before: { content: '"→"', color: "fg.subtle", fontWeight: "normal" } }}
        >
          <Box
            aria-hidden
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxSize="6"
            rounded="full"
            bg="primary"
            color="primary.contrast"
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
      {/* Breakpoints here apply from that width down: two columns, one on a tablet or a phone,
          where the sample comes between the heading and the button. */}
      <Grid
        w="full"
        maxW="1280px"
        mx="auto"
        px={{ base: "6", md: "5" }}
        pt={{ base: "10", md: "5" }}
        pb={{ base: "10", md: "6" }}
        gridTemplateColumns={{ base: "minmax(0, 1fr) 520px", lg: "minmax(0, 1fr)" }}
        gridTemplateAreas={{
          base: `"head aside" "actions aside"`,
          lg: `"head" "aside" "actions"`,
        }}
        alignContent="center"
        columnGap="16"
        rowGap={{ base: "9", md: "5" }}
      >
        <VStack gridArea="head" alignSelf="end" alignItems="stretch" gap={{ base: "3", md: "1.5" }}>
          <Heading as="h1" id={headingId} fontSize={{ base: "sm", md: "xs" }} color="brand">
            楽天お買い物マラソンのポイント計算ツール
          </Heading>
          <Text fontSize={{ base: "6xl", md: "3xl" }} fontWeight="black" lineHeight="1.2">
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
        <Box gridArea="aside" minW="0">
          {aside}
        </Box>
        <VStack gridArea="actions" alignSelf="start" alignItems="stretch" gap="0">
          <Flex
            gap="4"
            direction={{ base: "row", md: "column" }}
            align={{ base: "center", md: "stretch" }}
          >
            <Button colorScheme="primary" size="xl" disabled={disabled} onClick={onStart}>
              計算をはじめる
            </Button>
            <RouterButton
              to="/help"
              variant="outline"
              size="xl"
              display={{ base: "inline-flex", md: "none" }}
            >
              はじめての方へ
            </RouterButton>
            <RouterLink
              to="/help"
              color="link"
              fontWeight="bold"
              alignSelf="center"
              display={{ base: "none", md: "inline" }}
            >
              はじめての方へ
            </RouterLink>
          </Flex>
          {failed ? (
            <Box mt="3">
              <SaveFailed />
            </Box>
          ) : null}
          <VStack display={{ base: "flex", md: "none" }} mt="8" gap="3" alignItems="stretch">
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
