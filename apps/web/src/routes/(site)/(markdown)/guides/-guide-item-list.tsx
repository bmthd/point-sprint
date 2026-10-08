import { Badge, Box, Card, HStack, Image, LinkBox, SimpleGrid, Text } from "@workspaces/ui";
import type { GuideItem } from "../../../../guides/guide-items";

/** "2026年10月8日": the day in Japan, the same on the server and in the browser. */
const japanDay = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" });

function ItemCard({ item }: { item: GuideItem }) {
  return (
    <LinkBox.Root as="li" display="flex" flexDirection="column" gap="1">
      <Box bg="white" rounded="l2" overflow="hidden" aspectRatio="1">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" loading="lazy" boxSize="full" objectFit="contain" />
        ) : null}
      </Box>
      <LinkBox.Overlay
        href={item.url}
        target="_blank"
        // An affiliate link: `sponsored` tells search engines it is paid.
        rel="sponsored noopener"
        fontSize="sm"
        lineClamp={3}
        _hover={{ textDecoration: "underline" }}
      >
        {item.name}
      </LinkBox.Overlay>
      <Text fontWeight="bold" fontVariantNumeric="tabular-nums">
        {item.price.toLocaleString("ja-JP")}円
      </Text>
      <Text fontSize="xs" color="fg.muted" lineClamp={1}>
        {item.shopName}
      </Text>
    </LinkBox.Root>
  );
}

type GuideItemListProps = {
  /** The items the build found, or `undefined` when its call failed. */
  items: GuideItem[] | undefined;
  /** When the build fetched them (ISO 8601). */
  fetchedAt: string;
};

/**
 * Rakuten items with affiliate links, marked as an ad. Nothing is shown without items: the
 * article reads on without them.
 */
export function GuideItemList({ items, fetchedAt }: GuideItemListProps) {
  if (!items?.length) return null;
  return (
    // `data-guide-items` lets the build count the lists in the prerendered HTML.
    <Card.Root as="aside" aria-label="楽天市場の商品（広告）" data-guide-items my="6">
      <Card.Header>
        <HStack gap="2">
          <Badge colorScheme="mono" variant="outline">
            PR
          </Badge>
          <Text fontSize="sm" fontWeight="bold">
            楽天市場の商品
          </Text>
        </HStack>
      </Card.Header>
      <Card.Body>
        <SimpleGrid as="ul" columns={{ base: 3, sm: 2 }} gap="4" listStyle="none" m="0" p="0">
          {items.map((item) => (
            <ItemCard key={item.itemCode} item={item} />
          ))}
        </SimpleGrid>
      </Card.Body>
      <Card.Footer>
        <Text fontSize="xs" color="fg.muted">
          価格は{japanDay.format(new Date(fetchedAt))}
          時点のものです。最新の価格や在庫は楽天市場の商品ページでお確かめください。
        </Text>
      </Card.Footer>
    </Card.Root>
  );
}
