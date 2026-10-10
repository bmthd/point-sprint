import { Text } from "@workspaces/ui";
import { type Article, japaneseDate } from "../../../../guides/article";

/** The days an article was published and last changed. */
export function ArticleDates({ article }: { article: Article }) {
  return (
    <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
      公開日 <time dateTime={article.published}>{japaneseDate(article.published)}</time>
      {"・"}
      更新日 <time dateTime={article.updated}>{japaneseDate(article.updated)}</time>
    </Text>
  );
}
