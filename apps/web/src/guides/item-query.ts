import * as v from "valibot";

// `:::items{keyword="1000円ポッキリ" genreId=100227 hits=6}` in a guide: the item search parameters
// of a list of Rakuten items. Read by the build, which calls the API with them, and by the page,
// which shows what the build found for them.

const Integer = (min: number, max = Number.MAX_SAFE_INTEGER) =>
  v.pipe(v.string(), v.digits(), v.transform(Number), v.minValue(min), v.maxValue(max));

const Text = v.pipe(v.string(), v.trim(), v.nonEmpty());

/** The item search API's sort orders: `+` is ascending, `-` descending. */
const SortSchema = v.picklist([
  "standard",
  "+affiliateRate",
  "-affiliateRate",
  "+reviewCount",
  "-reviewCount",
  "+reviewAverage",
  "-reviewAverage",
  "+itemPrice",
  "-itemPrice",
  "+updateTimestamp",
  "-updateTimestamp",
]);

/** The parameters a list may set, by the item search API's own names. */
const ItemQuerySchema = v.pipe(
  v.strictObject({
    keyword: v.optional(Text),
    /** Words the items must not have. The API takes it only with `keyword`. */
    NGKeyword: v.optional(Text),
    genreId: v.optional(Integer(1)),
    minPrice: v.optional(Integer(0)),
    maxPrice: v.optional(Integer(0)),
    sort: v.optional(SortSchema),
    /** "1": only items whose price includes shipping. */
    postageFlag: v.optional(v.picklist(["0", "1"])),
    /** How many items to show: the API gives 30 at most. */
    hits: v.optional(Integer(1, 30), "6"),
  }),
  v.check(
    (query) => query.keyword !== undefined || query.genreId !== undefined,
    "needs a keyword or a genreId",
  ),
  v.check(
    (query) => query.NGKeyword === undefined || query.keyword !== undefined,
    "NGKeyword needs a keyword",
  ),
  v.check(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    "minPrice is above maxPrice",
  ),
);

export type ItemQuery = v.InferOutput<typeof ItemQuerySchema>;

const OPENING = /^:::items\{(.*)\}\s*$/;

/**
 * The query of a `:::items{…}` line, which takes `name="value"` or `name=value` pairs. A line that
 * is not one gives `undefined`; a broken one throws, so a typo fails the build instead of quietly
 * showing no items.
 */
export function parseItemsLine(line: string): ItemQuery | undefined {
  const opening = line.match(OPENING);
  if (!opening) return undefined;
  const pairs = opening[1] ?? "";
  const attributes: Record<string, string> = {};
  const rest = pairs.replace(/([A-Za-z]+)=(?:"([^"]*)"|([^\s"]+))/g, (_, name, quoted, bare) => {
    if (name in attributes) throw new Error(`:::items sets ${name} twice: ${line}`);
    attributes[name] = quoted ?? bare;
    return "";
  });
  if (rest.trim()) throw new Error(`:::items cannot read "${rest.trim()}": ${line}`);
  const parsed = v.safeParse(ItemQuerySchema, attributes);
  if (!parsed.success) {
    const problems = parsed.issues.map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new Error(`:::items is invalid (${problems.join("; ")}): ${line}`);
  }
  return parsed.output;
}

/** The same key for the same query, however its attributes were ordered in the Markdown. */
export const itemQueryKey = (query: ItemQuery) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(query).toSorted(([a], [b]) => a.localeCompare(b))),
  );

/** The queries of every `:::items{…}` line in a Markdown source, in order. */
export const itemQueriesIn = (markdown: string): ItemQuery[] =>
  markdown.split("\n").flatMap((line) => {
    const query = parseItemsLine(line);
    return query ? [query] : [];
  });
