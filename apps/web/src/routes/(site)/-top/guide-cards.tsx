import { Card, Heading, LinkBox, List, Text, VStack } from "@workspaces/ui";
import { useId } from "react";
import type { Article } from "../../../guides/article";
import { RouterLink } from "../../../ui/router-link";

/** How many of the newest guides the top page shows. */
const SHOWN = 4;

/** What a guide's card shows; the page's data holds only this, not the guides' text. */
export type GuideCard = Pick<Article, "slug" | "title" | "description">;

/** The cards of the newest guides, from the guides newest first. */
export function guideCards(articles: Article[]): GuideCard[] {
  return articles
    .slice(0, SHOWN)
    .map(({ slug, title, description }) => ({ slug, title, description }));
}

/** The newest shopping guides as cards, with a link to all of them. */
export function GuideCards({ articles }: { articles: GuideCard[] }) {
  const headingId = useId();
  return (
    <VStack as="section" aria-labelledby={headingId} gap="2.5" alignItems="stretch">
      <Heading as="h2" id={headingId} fontSize="md">
        買い物ガイド
      </Heading>
      {/* Breakpoints here apply from that width down: two columns, one on a phone. */}
      <List.Root
        display="grid"
        gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr)" }}
        gap="2.5"
      >
        {articles.map((article) => (
          <LinkBox.Root as="li" key={article.slug}>
            <Card.Root h="full">
              <Card.Body gap="1">
                <Heading as="h3" fontSize="md">
                  {/* A link that loads the page, as in the guide list: the guide's items are in
                      its prerendered HTML only. */}
                  <LinkBox.Overlay href={`/guides/${article.slug}`}>
                    {article.title}
                  </LinkBox.Overlay>
                </Heading>
                <Text fontSize="sm" lineClamp={2}>
                  {article.description}
                </Text>
              </Card.Body>
            </Card.Root>
          </LinkBox.Root>
        ))}
      </List.Root>
      <RouterLink to="/guides" fontSize="sm" color="link" alignSelf="end">
        すべての記事
      </RouterLink>
    </VStack>
  );
}
