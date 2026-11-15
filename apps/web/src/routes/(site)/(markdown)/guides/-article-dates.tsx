import { Text } from "@workspaces/ui";
import { type Article, japaneseDate } from "#/guides/article.ts";
import { operatorName } from "#/page-head.ts";
import { RouterLink } from "#/ui/router-link.tsx";

/**
 * The days an article was published and last changed, the latter only once it has been changed,
 * and who wrote it.
 */
export function ArticleDates({ article }: { article: Article }) {
  return (
    <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
      公開日 <time dateTime={article.published}>{japaneseDate(article.published)}</time>
      {article.updated !== undefined && (
        <>
          {"・"}
          更新日 <time dateTime={article.updated}>{japaneseDate(article.updated)}</time>
        </>
      )}
      {"・"}
      書いた人{" "}
      <RouterLink to="/about" color="link">
        {operatorName}
      </RouterLink>
    </Text>
  );
}
