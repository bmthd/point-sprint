import { shopAroundOutlook } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { ShopLadder } from "./shop-ladder";

const tiers = Array.from({ length: 9 }, (_, index) => ({ minShops: index + 2, rate: index + 1 }));

const outlook = (shopCount: number) =>
  shopAroundOutlook({
    benefitId: "b0000000-0000-4000-8000-000000000001",
    tiers,
    cap: 7000,
    amountBasis: "tax-excluded",
    shopCount,
    receivingBase: 10200,
  });

const rowTexts = (table: Element) =>
  Array.from(table.querySelectorAll("tbody tr")).map((row) => row.textContent);

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
  expect(rowTexts(table.element())).toEqual([
    "4店舗+3倍約22.3万円",
    "5店舗+4倍約16.5万円",
    "6店舗+5倍約13.0万円",
    "7店舗+6倍約10.6万円",
    "8店舗+7倍約9.0万円",
    "9店舗+8倍約7.7万円",
    "10店舗+9倍約6.8万円",
  ]);
  const current = table.element().querySelectorAll('tbody tr[aria-current="true"]');
  expect(Array.from(current, (row) => row.textContent)).toEqual(["4店舗+3倍約22.3万円"]);
});

test("shows only the current row until expanded when compact", async () => {
  await cleanup();
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <ShopLadder outlook={outlook(6)} compact />
    </UIProvider>,
  );

  const toggle = screen.getByText("あと何店舗回る？", { exact: true });
  const accordion = toggle.element().closest("details");
  expect(accordion).not.toBeNull();
  expect(accordion?.open).toBe(false);
  expect(rowTexts(screen.getByRole("table").element())).toEqual(["6店舗+5倍約13.0万円"]);

  await toggle.click();
  expect(accordion?.open).toBe(true);
  expect(rowTexts(screen.getByRole("table").element())).toHaveLength(5);
});
