import { Markdown } from "@tanstack/markdown/react";
import { Box, Heading } from "@workspaces/ui";
import { ArticleDates } from "./-article-dates";
import { GuideItemList } from "./-guide-item-list";
import type { Guide } from "../../../../guides/load-guide";
import { guideExtensions } from "../../../../guides/markdown";
import { GuideToc, guideSections, splitIntroduction } from "../-guide-toc";
import { headingIds, markdownComponents } from "../-markdown-body";

/**
 * A shopping guide: its title, its dates, and its Markdown with the lists of items. On a narrow
 * screen, where there is no sidebar, its contents follow the introduction.
 */
export function GuideArticle({ guide: { article, lists, fetchedAt } }: { guide: Guide }) {
  const components = {
    ...markdownComponents,
    "md-items": ({ query }: { query: string }) => (
      <GuideItemList items={lists[query]} fetchedAt={fetchedAt} />
    ),
  };
  const [introduction, sections] = splitIntroduction(article.body);
  const markdown = (text: string) => (
    <Markdown components={components} extensions={guideExtensions} headingIds={headingIds}>
      {text}
    </Markdown>
  );
  return (
    <Box as="article">
      <Box as="header" mb={{ base: "xl", md: "lg" }}>
        <Heading as="h1" fontSize={{ base: "4xl", md: "2xl" }} mb="1">
          {article.title}
        </Heading>
        <ArticleDates article={article} />
      </Box>
      {markdown(introduction)}
      <Box display={{ base: "none", lg: "block" }} my="lg">
        <GuideToc sections={guideSections(article.body)} />
      </Box>
      {markdown(sections)}
    </Box>
  );
}
