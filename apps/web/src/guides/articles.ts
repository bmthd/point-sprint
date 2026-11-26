import { tokyoToday } from "#/ui/dates.ts";
import { type Article, articleDates, newestFirst, parseArticle } from "./article.ts";

// The guides for the pages. Each file is loaded only when a page needs it.

const sources = import.meta.glob<string>("./articles/*.md", { query: "?raw", import: "default" });

const pathOf = (slug: string) => `./articles/${slug}.md`;

// The dates the build read from the git log. A guide added after the dev server started has none
// yet, and is published today.
const parse = (slug: string, source: string): Article => ({
  ...parseArticle(slug, source),
  ...(import.meta.env.GUIDE_DATES[slug] ?? articleDates([], tokyoToday(new Date()))),
});

/** The article at `/guides/<slug>`, or `undefined` when there is none. */
export async function loadArticle(slug: string): Promise<Article | undefined> {
  const load = sources[pathOf(slug)];
  return load ? parse(slug, await load()) : undefined;
}

/** Every article, newest first. */
export async function loadArticles(): Promise<Article[]> {
  const articles = await Promise.all(
    Object.entries(sources).map(async ([path, load]) =>
      parse(path.slice("./articles/".length, -".md".length), await load()),
    ),
  );
  return newestFirst(articles);
}
