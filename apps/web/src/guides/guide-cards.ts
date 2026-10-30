import type { Article } from "./article";

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
