import { expect, test } from "./fixtures";

// A URL no route matches gets the not-found page from the Worker, with a 404, not a prerendered page.

for (const path of ["/no-such-page", "/help/no-such-page"]) {
  test(`${path} shows the not-found page with a 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("ページが見つかりません | ポイントスプリント");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(
      page.getByRole("heading", { level: 1, name: "ページが見つかりません" }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);

    await page.getByRole("main").getByRole("link", { name: "トップへ戻る" }).click();
    await expect(page).toHaveURL("/");
  });
}
