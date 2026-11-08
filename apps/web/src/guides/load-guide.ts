import type { Article } from "./article.ts";
import { loadArticle } from "./articles.ts";
import type { GuideItem, GuideItemSearch } from "./guide-items.ts";
import { itemQueriesIn, itemQueryKey } from "./item-query.ts";

export type Guide = {
  article: Article;
  /** The items of each list, by `itemQueryKey`. */
  lists: Record<string, GuideItem[]>;
  /** When the items were searched (ISO 8601): the prices shown are the ones at that time. */
  fetchedAt: string;
};

/**
 * The guide at `/guides/<slug>` with the items of its lists, or `undefined` when there is none.
 * Without `search`, the guide has no items.
 */
export async function loadGuide(
  slug: string,
  search: GuideItemSearch | undefined,
  now = () => new Date(),
): Promise<Guide | undefined> {
  const article = await loadArticle(slug);
  if (!article) return undefined;
  const lists: Record<string, GuideItem[]> = {};
  if (search) {
    for (const query of itemQueriesIn(article.body)) {
      lists[itemQueryKey(query)] = await search(query);
    }
  }
  return { article, lists, fetchedAt: now().toISOString() };
}
