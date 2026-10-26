import { type Locator, type Page, expect } from "@playwright/test";
import { type NavigationOptions, SitePage, endsWithPath } from "./site-page";

/** 共通設定 (the profile): the SPU of each month, the shops and the advanced settings. */
export class ProfilePage {
  readonly heading: Locator;
  readonly backLink: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "共通設定" });
    this.backLink = page.getByRole("link", { name: "戻る" });
  }

  static async open(page: Page) {
    await page.goto("/profile");
    return new ProfilePage(page);
  }

  /** The field with a shop's name. */
  shopName(shop: string) {
    return this.page.getByRole("textbox", { name: `${shop}の名前` });
  }

  async renameShop(shop: string, name: string) {
    await this.shopName(shop).fill(name);
    await this.shopName(shop).press("Enter");
  }

  /** The switch that marks a shop as a 39ショップ. */
  shop39(shop: string) {
    return this.page.getByRole("switch", { name: `${shop} 39ショップ` });
  }

  /** The switch's input is visually hidden: a user clicks its label. */
  async toggleShop39(shop: string) {
    await this.page
      .locator("label")
      .filter({ has: this.shop39(shop) })
      .click();
  }

  async reload() {
    await this.page.reload();
    return new ProfilePage(this.page);
  }

  /** Goes back to the page the profile was opened from, at `path`. */
  async goBack(path: string, options?: NavigationOptions) {
    await this.backLink.click();
    await expect(this.page).toHaveURL(endsWithPath(path), options);
    return new SitePage(this.page);
  }
}
