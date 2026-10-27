import { type Page, test as base } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";

/** Every call to the Rakuten API, which only the Worker makes. */
const RAKUTEN_API = "https://openapi.rakuten.co.jp/**";

/** The images of Rakuten items, in the guides' lists. */
const RAKUTEN_IMAGES = "https://thumbnail.image.rakuten.co.jp/**";

/** Google Analytics and AdSense, which the production build loads on every page. */
const GOOGLE_TAGS = /^https:\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\//;

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
 * Cuts off the Rakuten API and its images, answers the Google tags with an empty script and stands
 * in for Turnstile, on a page of any context: no test calls the real services or sends hits to the
 * real properties.
 */
export async function standIn(page: Page): Promise<void> {
  await page.route(RAKUTEN_API, (route) => route.abort());
  await page.route(RAKUTEN_IMAGES, (route) => route.abort());
  await page.route(GOOGLE_TAGS, (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.route(TURNSTILE, (route) =>
    new URL(route.request().url()).pathname.endsWith("/api.js")
      ? route.fulfill({ contentType: "text/javascript", body: fakeTurnstile })
      : route.abort(),
  );
}

/**
 * Fixes the page's `new Date()` and `Date.now()` at `date`, on every load. Unlike
 * `page.clock.setFixedTime`, it leaves `performance.now()` and `requestAnimationFrame` as they are:
 * Playwright's fake `performance.now()` keeps counting across a reload while the page's animation
 * timeline starts again, and Motion starts its Web Animations (a Drawer's overlay fading out) at
 * `performance.now()`, so after a reload they started as late as the time before it.
 */
export async function fixDate(page: Page, date: Date): Promise<void> {
  await page.addInitScript((time) => {
    const RealDate = Date;
    // A Proxy keeps `Date.prototype`, so dates read back from IndexedDB are still `instanceof Date`.
    globalThis.Date = new Proxy(RealDate, {
      construct: (target, args, newTarget) =>
        Reflect.construct(target, args.length === 0 ? [time] : args, newTarget),
      apply: () => new RealDate(time).toString(),
    });
    RealDate.now = () => time;
  }, date.getTime());
}

/** Playwright's `test`, its page stood in for (`standIn`). A test answers them with `page.route`, which is tried before these. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await standIn(page);
    await use(page);
  },
});
