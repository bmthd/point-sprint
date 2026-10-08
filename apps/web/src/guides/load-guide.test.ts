import { expect, test, vi } from "vitest";
import type { GuideItem, GuideItemSearch } from "./guide-items";
import { loadGuide } from "./load-guide";

const item: GuideItem = {
  itemCode: "shop-a:1",
  name: "はとむぎ粉 330g",
  price: 1000,
  shopName: "ショップA",
  imageUrl: undefined,
  url: "https://hb.afl.rakuten.co.jp/hgc/x/",
};

const now = () => new Date("2026-10-08T00:00:00Z");

test("searches each list of the guide, and keeps the items by its query", async () => {
  // The food list fails; the others find an item.
  const search = vi.fn<GuideItemSearch>(async (query) =>
    query.genreId === 100227 ? undefined : [item],
  );
  const guide = await loadGuide("1000yen-items", search, now);

  expect(guide?.article.title).toBe("1000円ポッキリで買えるもの");
  expect(search).toHaveBeenCalledTimes(3);
  expect(Object.keys(guide?.lists ?? {})).toEqual([
    expect.stringContaining('"genreId":215783'),
    expect.stringContaining('"genreId":100939'),
  ]);
  expect(guide?.fetchedAt).toBe("2026-10-08T00:00:00.000Z");
});

test("without a search, the guide has no items", async () => {
  expect((await loadGuide("1000yen-items", undefined, now))?.lists).toEqual({});
});

test("an unknown slug finds no guide", async () => {
  expect(await loadGuide("no-such-guide", undefined, now)).toBeUndefined();
});
