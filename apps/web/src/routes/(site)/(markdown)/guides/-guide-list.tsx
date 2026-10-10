import { Card, Heading, LinkBox, Text, VStack } from "@workspaces/ui";
import type { Article } from "../../../../guides/article";
import { ArticleDates } from "./-article-dates";

/** Every shopping guide, newest first. */
export function GuideList({ articles }: { articles: Article[] }) {
  return (
    <VStack gap="4" alignItems="stretch">
      <Heading as="h1" fontSize="lg">
        買い物ガイド
      </Heading>
      <Text>お買い物マラソンで何を買うか迷ったときの、目的ごとの商品の探し方です。</Text>
      <VStack as="ul" listStyle="none" m="0" p="0" gap="2.5" alignItems="stretch">
        {articles.map((article) => (
          <LinkBox.Root as="li" key={article.slug}>
            <Card.Root>
              <Card.Body gap="1">
                <Heading as="h2" fontSize="md">
                  {/* A link that loads the page, not one the router follows: the guide's items are
                      in its prerendered HTML only (`getGuide`). */}
                  <LinkBox.Overlay href={`/guides/${article.slug}`}>
                    {article.title}
                  </LinkBox.Overlay>
                </Heading>
                <Text fontSize="sm">{article.description}</Text>
                <ArticleDates article={article} />
              </Card.Body>
            </Card.Root>
          </LinkBox.Root>
        ))}
      </VStack>
    </VStack>
  );
}
