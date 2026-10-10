import { Markdown } from "@tanstack/markdown/react";
import { Box, Heading } from "@workspaces/ui";
import { ArticleDates } from "./-article-dates";
import { GuideItemList } from "./-guide-item-list";
import type { Guide } from "../../../../guides/load-guide";
import { guideExtensions } from "../../../../guides/markdown";
import { headingIds, markdownComponents } from "../-markdown-body";

/** A shopping guide: its title, its dates, and its Markdown with the lists of items. */
export function GuideArticle({ guide: { article, lists, fetchedAt } }: { guide: Guide }) {
  const components = {
    ...markdownComponents,
    "md-items": ({ query }: { query: string }) => (
      <GuideItemList items={lists[query]} fetchedAt={fetchedAt} />
    ),
  };
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
