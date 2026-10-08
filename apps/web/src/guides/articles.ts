import { type Article, newestFirst, parseArticle } from "./article";

// The guides for the pages. Each file is loaded only when a page needs it.

const sources = import.meta.glob<string>("./articles/*.md", { query: "?raw", import: "default" });

const pathOf = (slug: string) => `./articles/${slug}.md`;

/** The article at `/guides/<slug>`, or `undefined` when there is none. */
export async function loadArticle(slug: string): Promise<Article | undefined> {
  const load = sources[pathOf(slug)];
  return load ? parseArticle(slug, await load()) : undefined;
}

/** Every article, newest first. */
export async function loadArticles(): Promise<Article[]> {
  const articles = await Promise.all(
    Object.entries(sources).map(async ([path, load]) =>
      parseArticle(path.slice("./articles/".length, -".md".length), await load()),
    ),
  );
  return newestFirst(articles);
}
