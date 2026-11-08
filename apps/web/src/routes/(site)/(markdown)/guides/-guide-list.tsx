import { Box, Card, Heading, LinkBox, List, Text, VStack } from "@workspaces/ui";
import type { Article } from "#/guides/article.ts";
import { GuideThumbnail } from "#/routes/(site)/-guide-card.tsx";
import { ArticleDates } from "./-article-dates.tsx";

/** Every shopping guide, newest first. */
export function GuideList({ articles }: { articles: Article[] }) {
  return (
    <VStack gap="4" alignItems="stretch">
      <Heading as="h1" fontSize="lg">
        買い物ガイド
      </Heading>
      <Text>お買い物マラソンで何を買うか迷ったときの、目的ごとの商品の探し方です。</Text>
      <List.Root gap="2.5">
        {articles.map((article) => (
          <LinkBox.Root as="li" key={article.slug}>
            {/* The thumbnail on the left, at its own proportions, sets the card's height; the text
                on its right is cut to the lines that fit beside it. Breakpoints here apply from
                that width down: a phone shows the title alone. */}
            <Card.Root flexDirection="row" alignItems="center" overflow="hidden">
              {/* The title beside it names the link, so the picture has no text of its own. */}
              <GuideThumbnail
                slug={article.slug}
                alt=""
                w={{ base: "80", sm: "40" }}
                flexShrink="0"
                alignSelf="flex-start"
              />
              <Card.Body gap="1" minW="0" py="2">
                <Heading as="h2" fontSize={{ base: "md", sm: "sm" }} lineClamp={{ base: 2, sm: 3 }}>
                  {/* A link that loads the page, not one the router follows: the guide's items
                      are in its prerendered HTML only (`getGuide`). */}
                  <LinkBox.Overlay href={`/guides/${article.slug}`}>
                    {article.title}
                  </LinkBox.Overlay>
                </Heading>
                <Text fontSize="sm" lineClamp={2} display={{ base: "-webkit-box", sm: "none" }}>
                  {article.description}
                </Text>
                <Box display={{ base: "block", sm: "none" }}>
                  <ArticleDates article={article} />
                </Box>
              </Card.Body>
            </Card.Root>
          </LinkBox.Root>
        ))}
      </List.Root>
    </VStack>
  );
}
