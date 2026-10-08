import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";

/** Every call to the Rakuten API. */
export const RAKUTEN_API = "https://openapi.rakuten.co.jp/**";

/** Turnstile's script and its other files. */
const TURNSTILE = "https://challenges.cloudflare.com/**";

/** A Turnstile that renders a button, which passes the check with `e2e-token` when clicked. */
const fakeTurnstile = `window.turnstile = {
  render(container, options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "確認を済ませる";
    button.onclick = () => options.callback("e2e-token");
    container.append(button);
    return "e2e-widget";
  },
  reset() {},
  remove() {},
};`;

/**
 * Playwright's `test`, with the Rakuten API cut off and Turnstile stood in for: no test calls the
 * real services. A test answers them with `page.route`, which is tried before these.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(RAKUTEN_API, (route) => route.abort());
    await page.route(TURNSTILE, (route) =>
      new URL(route.request().url()).pathname.endsWith("/api.js")
        ? route.fulfill({ contentType: "text/javascript", body: fakeTurnstile })
        : route.abort(),
    );
    await use(page);
  },
});
