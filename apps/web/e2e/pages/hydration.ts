import { type Page, expect } from "@playwright/test";

/**
 * Waits until the page has hydrated (`data-hydrated` on `<html>`). Before that a click on the
 * prerendered HTML can do nothing, or land elsewhere when the router puts the scroll back to the
 * top as it hydrates.
 */
export async function hydrated(page: Page) {
  // Hydrating is the end of loading the page, which `page.goto` waits for without an assertion's
  // 5 seconds: the page's scripts load and run after `load`, and take longer on a busy machine.
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", { timeout: 15_000 });
}

/** Opens `path` and waits until the page has hydrated. */
export async function openHydrated(page: Page, path: string) {
  const response = await page.goto(path);
  await hydrated(page);
  return response;
}
