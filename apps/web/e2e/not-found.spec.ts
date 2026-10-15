import { expect, test } from "./fixtures";
import { NotFoundPage } from "./pages";

// A URL no route matches gets the not-found page from the Worker, with a 404, not a prerendered page.

for (const path of ["/no-such-page", "/help/no-such-page"]) {
  test(`${path} shows the not-found page with a 404`, async ({ page }) => {
    const notFound = await NotFoundPage.open(page, path);
    expect(notFound.response?.status()).toBe(404);
    await expect(page).toHaveTitle("ページが見つかりません | ポイントスプリント");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(notFound.heading).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);

    await notFound.goToTop();
  });
}
