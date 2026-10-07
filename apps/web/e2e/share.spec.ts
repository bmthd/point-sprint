import { type Page, expect, test } from "./fixtures";

// Where the share buttons are, and what they share. The tests take the Web Share API away, so the
// buttons open the links that every browser has.

/** Creates a plan from the top page and returns its id. */
async function createPlan(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  await expect(page).toHaveURL(/\/plan\?id=/);
  return new URL(page.url()).searchParams.get("id") ?? "";
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
});

const shareResult = (page: Page) => page.getByRole("button", { name: "結果をシェア" });

test("on a wide screen the result's share button ends the right column", async ({ page }) => {
  await createPlan(page);
  const column = page.getByRole("complementary", { name: "結果" });
  await expect(column.getByRole("button", { name: "結果をシェア" })).toBeVisible();
  const last = column.locator(":scope > *").last();
  await expect(last.getByRole("button", { name: "結果をシェア" })).toBeVisible();
});

test("on a phone the result's share button comes after the orders", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPlan(page);
  await expect(shareResult(page)).toHaveCount(1);
  const orders = await page.locator("#orders").boundingBox();
  const button = await shareResult(page).boundingBox();
  expect(button?.y ?? 0).toBeGreaterThan((orders?.y ?? 0) + (orders?.height ?? 0));
});

test("the result is shared with its points, linking to the site", async ({ page }) => {
  await createPlan(page);
  await shareResult(page).click();
  const href = await page.getByRole("link", { name: "X でシェア" }).getAttribute("href");
  const query = new URL(href ?? "").searchParams;
  expect(query.get("text")).toMatch(/^獲得予定 [\d,]+P.*（ポイントスプリントで計算）$/);
  expect(query.get("url")).toBe("https://point-sprint.bmth.dev/");
});

test("the footer shares the site on every page", async ({ page }) => {
  for (const path of ["/", "/help", "/terms"]) {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    const button = footer.getByRole("button", { name: "このサイトをシェア" });
    // Retried: a click before the prerendered page hydrates does nothing.
    await expect(async () => {
      if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass();
    const href = await footer.getByRole("link", { name: "Facebook でシェア" }).getAttribute("href");
    expect(new URL(href ?? "").searchParams.get("u")).toBe("https://point-sprint.bmth.dev/");
  }
});
