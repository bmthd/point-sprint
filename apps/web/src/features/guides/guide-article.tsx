import { Markdown } from "@tanstack/markdown/react";
import { Box, Heading } from "@workspaces/ui";
import guideItems from "virtual:guide-items";
import type { Article } from "../../guides/article";
import { guideExtensions } from "../../guides/markdown";
import { headingIds, markdownComponents } from "../../routes/(markdown)/-markdown-body";
import { ArticleDates } from "./article-dates";
import { GuideItemList } from "./guide-item-list";

const components = {
  ...markdownComponents,
  "md-items": ({ query }: { query: string }) => (
    <GuideItemList items={guideItems.lists[query]} fetchedAt={guideItems.fetchedAt} />
  ),
};

/** A shopping guide: its title, its dates, and its Markdown with the lists of items. */
export function GuideArticle({ article }: { article: Article }) {
  return (
    <Box as="article">
      <Heading as="h1" fontSize="lg" mb="1">
        {article.title}
      </Heading>
      <ArticleDates article={article} />
      <Markdown components={components} extensions={guideExtensions} headingIds={headingIds}>
        {article.body}
      </Markdown>
    </Box>
  );
}
