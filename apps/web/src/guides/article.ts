import * as v from "valibot";

// A shopping guide is one Markdown file in `articles/`, named by its slug (`1000yen-items.md` is
// `/guides/1000yen-items`). Its data is the frontmatter at the top:
//
//   ---
//   title: 1000円ポッキリで買えるもの
//   description: 検索結果やリンクの説明に出す文
//   published: 2026-10-08
//   updated: 2026-10-20
//   ---
//
// `updated` is written only once the article is changed after the day it was published.

const Text = v.pipe(v.string(), v.trim(), v.nonEmpty());

const FrontmatterSchema = v.pipe(
  v.strictObject({
    title: Text,
    description: Text,
    /** `YYYY-MM-DD`. */
    published: v.pipe(v.string(), v.isoDate()),
    /** `YYYY-MM-DD`: the day it was last changed, after `published`. None until it is changed. */
    updated: v.optional(v.pipe(v.string(), v.isoDate())),
  }),
  v.check(
    ({ published, updated }) => updated === undefined || published < updated,
    "updated is not after published: leave it out until the article is changed",
  ),
);

export type Article = v.InferOutput<typeof FrontmatterSchema> & {
  slug: string;
  /** The Markdown after the frontmatter. */
  body: string;
};

/** A slug is part of the URL: lower case letters, digits and hyphens, telling what it is about. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The article in a Markdown file. A file without the frontmatter, or with a field missing or
 * wrong, throws: the build fails rather than publishing a page without its title or dates.
 */
export function parseArticle(slug: string, source: string): Article {
  if (!SLUG.test(slug)) throw new Error(`The guide "${slug}" needs a slug like 1000yen-items`);
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`The guide "${slug}" has no frontmatter (--- … ---) at the top`);
  const fields = Object.fromEntries(
    (match[1] ?? "")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const field = line.match(/^(\w+):\s*(.*)$/);
        if (!field) throw new Error(`The guide "${slug}" cannot read "${line}" in its frontmatter`);
        return [field[1], field[2]?.replace(/^"(.*)"$/, "$1")];
      }),
  );
  const parsed = v.safeParse(FrontmatterSchema, fields);
  if (!parsed.success) {
    const problems = parsed.issues.map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new Error(`The guide "${slug}" has a wrong frontmatter: ${problems.join("; ")}`);
  }
  return { ...parsed.output, slug, body: source.slice(match[0].length) };
}

/** Newest first, by the day each was published. */
export function newestFirst(articles: Article[]) {
  return articles.toSorted(
    (a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug),
  );
}

/** "2026年10月8日", from `YYYY-MM-DD`. */
export function japaneseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
