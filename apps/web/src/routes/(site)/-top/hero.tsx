import { Box, Button, Card, Heading, HStack, Text, VStack } from "@workspaces/ui";

/** A fixed result card, so a visitor sees what the tool answers; it is not computed. */
function SampleCard() {
  return (
    <Card.Root variant="solid" colorScheme="primary" maxW="360px" w="full" aria-hidden>
      <Card.Body gap="2">
        <Text fontSize="xs">画面の見本</Text>
        <Text fontSize="sm">獲得予定</Text>
        <Text fontSize="4xl" fontWeight="bold" lineHeight="1">
          4,820P
        </Text>
        <Text fontSize="sm">8 / 10 店舗・上限まであと 2,180P</Text>
      </Card.Body>
    </Card.Root>
  );
}

/** The top page's first screen: what the tool is, how to start, and a sample answer. */
export function Hero({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <Box bg="bg.panel" borderBottomWidth="1px">
      <Box
        maxW="1120px"
        mx="auto"
        px="md"
        py={{ base: "8", md: "12" }}
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" }}
        alignItems="center"
        columnGap="12"
        rowGap="8"
      >
        <VStack alignItems="stretch" gap="4">
          <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }}>
            楽天お買い物マラソンのポイント計算ツール
          </Heading>
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
            何店舗・いくら買えば上限に届くか、買う前にわかる
          </Text>
          <Text color="fg.muted">
            買うものを入れるだけで、買いまわりの倍率、SPU、上限まで含めたもらえるポイントと、あと何店舗回ればいいかを計算します。無料・登録不要。
          </Text>
          <HStack gap="3" flexWrap="wrap">
            <Button colorScheme="primary" size="lg" disabled={disabled} onClick={onStart}>
              計算をはじめる
            </Button>
            <Button as="a" href="#how-to" variant="outline" size="lg">
              はじめての方へ
            </Button>
          </HStack>
        </VStack>
        <SampleCard />
      </Box>
    </Box>
  );
}
