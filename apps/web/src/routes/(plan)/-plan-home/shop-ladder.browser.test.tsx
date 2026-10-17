import { shopAroundOutlook } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import type { Locator } from "vitest/browser";
import { expectTexts } from "../../../test-texts";
import { ShopLadder } from "./shop-ladder";

const tiers = Array.from({ length: 9 }, (_, index) => ({ minShops: index + 2, rate: index + 1 }));

const outlook = (shopCount: number, receivingBase = 10200) =>
  shopAroundOutlook({
    benefitId: "b0000000-0000-4000-8000-000000000001",
    tiers,
    cap: 7000,
    amountBasis: "tax-excluded",
    shopCount,
    receivingBase,
  });

/** The body rows a person can see: the folded rows are hidden. */
const bodyRows = (table: Locator) => table.getByRole("rowgroup").last().getByRole("row");

test("highlights the current shop count row", async () => {
  await cleanup();
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <ShopLadder outlook={outlook(4)} />
    </UIProvider>,
  );

  const table = screen.getByRole("table");
  await expect.element(table).toBeVisible();
  // From the current count up to the top tier. 7,000P at +3倍 is ¥233,334; ¥10,200 is bought.
  await expectTexts(bodyRows(table), [
    "4店舗+3倍約22.3万円",
    "5店舗+4倍約16.5万円",
    "6店舗+5倍約13.0万円",
    "7店舗+6倍約10.6万円",
    "8店舗+7倍約9.0万円",
    "9店舗+8倍約7.7万円",
    "10店舗+9倍約6.8万円",
  ]);
  // Only the first row, 4店舗, is the current one.
  await expect.element(bodyRows(table).first()).toHaveAttribute("aria-current", "true");
  for (const index of [1, 2, 3, 4, 5, 6]) {
    await expect.element(bodyRows(table).nth(index)).not.toHaveAttribute("aria-current");
  }
});

test("rows that reach the cap say so instead of an amount", async () => {
  await cleanup();
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <ShopLadder outlook={outlook(3, 120000)} />
    </UIProvider>,
  );

  // ¥120,000 at +6倍 and up earns 7,200P or more, past the 7,000P cap. Rows from 3店舗 to 10店舗.
  const rows = bodyRows(screen.getByRole("table"));
  await expect.element(rows).toHaveLength(8);
  for (const [index, text] of [
    "6店舗+5倍約2.0万円",
    "7店舗+6倍上限",
    "8店舗+7倍上限",
    "9店舗+8倍上限",
    "10店舗+9倍上限",
  ].entries()) {
    await expect.element(rows.nth(index + 3)).toHaveTextContent(text);
  }
});

test("shows only the current row until the others are opened when compact", async () => {
  await cleanup();
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <ShopLadder outlook={outlook(6)} compact />
    </UIProvider>,
  );

  await expect.element(screen.getByRole("heading", { name: "あと何店舗回る？" })).toBeVisible();
  // One table: the other rows open inside it, under the current one.
  const table = screen.getByRole("table", { includeHidden: true });
  await expect.element(table).toHaveLength(1);
  await expectTexts(bodyRows(table), ["6店舗+5倍約13.0万円"]);

  await screen.getByText("ほかの店舗数を見る", { exact: true }).click();
  await expectTexts(bodyRows(table), [
    "6店舗+5倍約13.0万円",
    "7店舗+6倍約10.6万円",
    "8店舗+7倍約9.0万円",
    "9店舗+8倍約7.7万円",
    "10店舗+9倍約6.8万円",
  ]);
});
