import { type Page, expect } from "@playwright/test";
import { TopPage } from "./top-page";

/** The page of a shared result, at `/share` with its figures in the query. */
export class SharePage {
  constructor(readonly page: Page) {}

  static async open(page: Page, query = "") {
    await page.goto(`/share${query}`);
    return new SharePage(page);
  }

  /** The `content` of the page's `<meta property>`. */
  ogp(property: string) {
    return this.page.locator(`meta[property="${property}"]`).getAttribute("content");
  }

  async goToCalculator() {
    await this.page.getByRole("link", { name: "自分の還元率を計算する" }).click();
    await expect(this.page).toHaveURL("/");
    return new TopPage(this.page);
  }
}
