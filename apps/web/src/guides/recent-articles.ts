import type { Article } from "./article.ts";

/** How many articles the sidebar lists. */
export const RECENT_SHOWN = 3;

/** An article as the sidebar lists it: the day it was last changed, or published if never. */
export type RecentArticle = Pick<Article, "slug" | "title"> & { date: string };

/**
 * The articles changed most recently, one more than the sidebar lists, so that it still has
 * enough on the page of one of them, which it leaves out.
 */
export function recentArticles(articles: readonly Article[]): RecentArticle[] {
  return articles
    .map(({ slug, title, published, updated }) => ({ slug, title, date: updated ?? published }))
    .toSorted((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .slice(0, RECENT_SHOWN + 1);
}
