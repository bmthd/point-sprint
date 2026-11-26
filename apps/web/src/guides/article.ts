import * as v from "valibot";

// A shopping guide is one Markdown file in `articles/`, named by its slug (`1000yen-items.md` is
// `/guides/1000yen-items`). Its data is the frontmatter at the top:
//
//   ---
//   title: 1000円ポッキリで買えるもの
//   description: 検索結果やリンクの説明に出す文
//   tags: お買い物マラソン, 商品の紹介
//   ---
//
// The days it was published and changed are not written: the build reads them from the git log
// (`git-dates.ts`), so that they are the days the changes reached main.
//
// `cardLead` and `cardFigure` are the words of its thumbnail (`thumbnail.ts`), written together:
// the figure is the article's answer, drawn large under the lead.
//
//   cardLead: あと1店舗を足すなら
//   cardFigure: 1,000円ポッキリ

const Text = v.pipe(v.string(), v.trim(), v.nonEmpty());

/**
 * The tags a guide may have, telling what kind of article it is. Only these: a new one is added
 * here, so that the same meaning is never written two ways.
 */
export const GUIDE_TAGS = [
  "お買い物マラソン",
  "ポイントの計算",
  "楽天カード",
  "キャンペーン",
  "商品の紹介",
] as const;

export type GuideTag = (typeof GUIDE_TAGS)[number];

/** `tags: a, b`: one tag or more, in the order written, each once. */
const Tags = v.pipe(
  v.string(),
  v.transform((line) => line.split(",").map((tag) => tag.trim())),
  v.array(v.picklist(GUIDE_TAGS)),
  v.minLength(1),
  v.check((tags) => new Set(tags).size === tags.length, "a tag is written twice"),
);

const FrontmatterSchema = v.pipe(
  v.strictObject({
    title: Text,
    description: Text,
    tags: Tags,
    /** The line above the thumbnail's figure. */
    cardLead: v.optional(Text),
    /** The thumbnail's figure: the article's answer, in a few letters. */
    cardFigure: v.optional(Text),
  }),
  v.check(
    ({ cardLead, cardFigure }) => (cardLead === undefined) === (cardFigure === undefined),
    "cardLead and cardFigure go together: write both, or neither for a thumbnail of the title",
  ),
);

/** The days an article was published and last changed, as `YYYY-MM-DD` in Japan. */
export type ArticleDates = {
  published: string;
  /** The day it was last changed, after `published`. None until it is changed on a later day. */
  updated?: string;
};

/**
 * The dates of an article from the days of its commits, the newest first. One never committed is
 * published `today`.
 */
export function articleDates(commitDays: readonly string[], today: string): ArticleDates {
  const published = commitDays.at(-1) ?? today;
  const latest = commitDays[0] ?? today;
  return latest > published ? { published, updated: latest } : { published };
}

/** A guide's file: its frontmatter, and the Markdown after it. */
export type ArticleFile = v.InferOutput<typeof FrontmatterSchema> & {
  slug: string;
  /** The Markdown after the frontmatter. */
  body: string;
};

export type Article = ArticleFile & ArticleDates;

/** A slug is part of the URL: lower case letters, digits and hyphens, telling what it is about. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The guide in a Markdown file. A file without the frontmatter, or with a field missing or wrong,
 * throws: the build fails rather than publishing a page without its title.
 */
export function parseArticle(slug: string, source: string): ArticleFile {
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
