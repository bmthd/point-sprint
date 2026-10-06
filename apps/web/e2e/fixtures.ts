import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";

/** Every call to the Rakuten API. */
export const RAKUTEN_API = "https://openapi.rakuten.co.jp/**";

/**
 * Playwright's `test`, with the Rakuten API cut off: no test calls the real API. A test answers
 * it with `page.route`, which is tried before this.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(RAKUTEN_API, (route) => route.abort());
    await use(page);
  },
});
