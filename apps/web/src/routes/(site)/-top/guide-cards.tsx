import { Heading, List, VStack } from "@workspaces/ui";
import { useId } from "react";
import type { GuideCard as GuideCardData } from "../../../guides/guide-cards";
import { RouterLink } from "../../../ui/router-link";
import { GuideCard } from "../-guide-card";

/** The newest shopping guides as their thumbnails, with a link to all of them. */
export function GuideCards({ articles }: { articles: GuideCardData[] }) {
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
          <GuideCard key={article.slug} article={article} />
        ))}
      </List.Root>
      <RouterLink to="/guides" fontSize="sm" color="link" alignSelf="end">
        すべての記事
      </RouterLink>
    </VStack>
  );
}
