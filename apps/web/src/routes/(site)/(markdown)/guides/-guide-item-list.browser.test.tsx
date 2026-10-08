import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import type { GuideItem } from "../../../../guides/guide-items";
import { GuideItemList } from "./-guide-item-list";

const AFFILIATE_URL =
  "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop-a%2Fitem-1%2F";

const items: GuideItem[] = [
  {
    itemCode: "shop-a:1",
    name: "はとむぎ粉 330g",
    price: 1000,
    shopName: "ショップA",
    imageUrl: undefined,
    url: AFFILIATE_URL,
  },
  {
    itemCode: "shop-b:2",
    name: "フェイスタオル 5枚セット",
    price: 1280,
    shopName: "ショップB",
    imageUrl: undefined,
    url: "https://item.rakuten.co.jp/shop-b/item-2/",
  },
];

const renderList = (list: GuideItem[] | undefined) =>
  render(
    <UIProvider theme={theme} config={config}>
      <GuideItemList items={list} fetchedAt="2026-10-07T23:54:47.549Z" />
    </UIProvider>,
  );

test("marks the items as an ad, and links each to Rakuten as a paid link", async () => {
  const screen = await renderList(items);
  const list = screen.getByRole("complementary", { name: "楽天市場の商品（広告）" });
  await expect.element(list.getByText("PR", { exact: true })).toBeVisible();

  const link = list.getByRole("link", { name: "はとむぎ粉 330g" });
  await expect.element(link).toHaveAttribute("href", AFFILIATE_URL);
  await expect.element(link).toHaveAttribute("target", "_blank");
  await expect.element(link).toHaveAttribute("rel", "sponsored noopener");
  await expect.element(list.getByText("1,280円")).toBeVisible();
  await expect.element(list.getByText("ショップB")).toBeVisible();
});

test("tells the day of the prices, in Japan", async () => {
  const screen = await renderList(items);
  // 23:54 UTC on the 7th is the 8th in Japan.
  await expect.element(screen.getByText(/価格は2026年10月8日時点のものです/)).toBeVisible();
});

test.each([
  { case: "a failed call", list: undefined },
  { case: "no items found", list: [] },
])("shows nothing for $case", async ({ list }) => {
  const screen = await renderList(list);
  expect(screen.container.textContent).toBe("");
});
