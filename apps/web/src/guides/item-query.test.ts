import { expect, test } from "vitest";
import { itemQueriesIn, itemQueryKey, parseItemsLine } from "./item-query";

test("reads quoted and bare values, and turns numbers into numbers", () => {
  expect(
    parseItemsLine(
      ':::items{keyword="1000円 ポッキリ" NGKeyword="訳あり" genreId=100227 minPrice=1000 maxPrice=1000 sort="-reviewCount" postageFlag=1 hits=10}',
    ),
  ).toEqual({
    keyword: "1000円 ポッキリ",
    NGKeyword: "訳あり",
    genreId: 100227,
    minPrice: 1000,
    maxPrice: 1000,
    sort: "-reviewCount",
    postageFlag: "1",
    hits: 10,
  });
});

test("shows 6 items unless told otherwise", () => {
  expect(parseItemsLine(":::items{genreId=100227}")).toEqual({ genreId: 100227, hits: 6 });
});

test("a line that is not a list is left alone", () => {
  expect(parseItemsLine("1000円ポッキリの商品")).toBeUndefined();
  expect(parseItemsLine(":::details 見出し")).toBeUndefined();
});

test.each([
  { line: ":::items{}", error: "needs a keyword or a genreId" },
  { line: ':::items{keyword="a" color="red"}', error: "color" },
  { line: ':::items{keyword="a" hits=31}', error: "hits" },
  { line: ':::items{keyword="a" hits=many}', error: "hits" },
  { line: ':::items{keyword="a" sort="cheap"}', error: "sort" },
  { line: ':::items{keyword=""}', error: "keyword" },
  { line: ":::items{genreId=1 NGKeyword=x}", error: "NGKeyword needs a keyword" },
  { line: ':::items{keyword="a" minPrice=2000 maxPrice=1000}', error: "minPrice is above" },
  { line: ':::items{keyword="a" keyword="b"}', error: "keyword twice" },
  { line: ':::items{keyword="a" hits = 3}', error: "cannot read" },
])("a broken list throws: $error", ({ line, error }) => {
  expect(() => parseItemsLine(line)).toThrow(error);
});

test("the same query has the same key, in whatever order it is written", () => {
  const a = parseItemsLine(':::items{keyword="a" hits=3 genreId=1}');
  const b = parseItemsLine(':::items{genreId=1 keyword="a" hits=3}');
  expect(a && itemQueryKey(a)).toBe(b && itemQueryKey(b));
});

test("finds every list in a Markdown source", () => {
  const markdown = '# 見出し\n\n:::items{keyword="a"}\n\n本文\n\n:::items{genreId=1 hits=3}\n';
  expect(itemQueriesIn(markdown)).toEqual([
    { keyword: "a", hits: 6 },
    { genreId: 1, hits: 3 },
  ]);
});
