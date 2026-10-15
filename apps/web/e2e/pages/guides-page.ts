import { type Page, expect } from "@playwright/test";

/** The guide list. */
export class GuidesPage {
  constructor(readonly page: Page) {}

  static async open(page: Page) {
    await page.goto("/guides");
    return new GuidesPage(page);
  }

  /** Follows the link to the guide titled `title`, at `path`. */
  async goToGuide(title: string, path: string) {
    await this.page.getByRole("link", { name: title }).click();
    // A page load: the static files are served at the path with a trailing slash.
    await expect(this.page).toHaveURL(new RegExp(`${path}/?$`));
    return new GuidePage(this.page);
  }
}

/** A guide. */
export class GuidePage {
  constructor(readonly page: Page) {}

  static async open(page: Page, path: string) {
    await page.goto(path);
    return new GuidePage(page);
  }

  heading(level: 1 | 2, name: string) {
    return this.page.getByRole("heading", { level, name });
  }

  /** The lists of the items found. */
  get itemLists() {
    return this.page.getByRole("complementary", { name: "楽天市場の商品（広告）" });
  }
}
