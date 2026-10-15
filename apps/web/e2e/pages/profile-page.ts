import { type Locator, type Page, expect } from "@playwright/test";
import { type NavigationOptions, SitePage, endsWithPath } from "./site-page";

/** The profile: the SPU defaults and the shops. */
export class ProfilePage {
  readonly heading: Locator;
  readonly backLink: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "プロフィール" });
    this.backLink = page.getByRole("link", { name: "戻る" });
  }

  static async open(page: Page) {
    await page.goto("/profile");
    return new ProfilePage(page);
  }

  /** An SPU tile, such as `楽天モバイル +4倍`. */
  spuTile(name: string) {
    return this.page.getByRole("checkbox", { name });
  }

  /** Taps an SPU tile on its label: its checkbox is visually hidden. */
  async toggleSpuTile(name: string) {
    await this.spuTile(name).locator("xpath=ancestor::label[1]").click();
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
