import { Box, Heading, Image, Text, VStack } from "@workspaces/ui";
import { RouterButton } from "../../router-link";
import {
  type ResultFigures,
  imageSize,
  resultImagePath,
  resultSummary,
} from "../../share/result-card";

/**
 * The page a result is shared as, at `/share`. It shows the figures the link carries and leads to
 * the top page; a link without them shows only the way there.
 */
export function SharedResultPage({ figures }: { figures: ResultFigures | undefined }) {
  return (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <VStack gap="5" alignItems="stretch">
        <Heading as="h1" fontSize="lg">
          シェアされた計算結果
        </Heading>
        {figures ? (
          <Image
            src={resultImagePath(figures)}
            alt={resultSummary(figures)}
            {...imageSize}
            w="full"
            h="auto"
            rounded="lg"
          />
        ) : (
          <Text color="fg.muted">計算結果が見つかりませんでした。</Text>
        )}
        <Text fontSize="sm" color="fg.muted">
          お買い物マラソンで買うものを入れると、獲得できるポイントと実質還元率を計算できます。
        </Text>
        <RouterButton to="/" colorScheme="primary" size="lg" alignSelf="center">
          自分の還元率を計算する
        </RouterButton>
      </VStack>
    </Box>
  );
}
