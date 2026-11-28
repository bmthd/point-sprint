import { type Page, expect } from "@playwright/test";
import { TopPage } from "./top-page.ts";
import { hydrated, openHydrated } from "./hydration.ts";

/** The page of a shared result, at `/share` with its figures in the query. */
export class SharePage {
  constructor(readonly page: Page) {}

  static async open(page: Page, query = "") {
    await openHydrated(page, `/share${query}`);
    return new SharePage(page);
  }

  /** The `content` of the page's `<meta property>`. */
  ogp(property: string) {
    return this.page.locator(`meta[property="${property}"]`).getAttribute("content");
  }

  async goToCalculator() {
    await this.page.getByRole("link", { name: "自分の還元率を計算する" }).click();
    await expect(this.page).toHaveURL("/");
    await hydrated(this.page);
    return new TopPage(this.page);
  }
}
