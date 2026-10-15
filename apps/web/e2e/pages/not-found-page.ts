import { type Page, type Response, expect } from "@playwright/test";
import { TopPage } from "./top-page";

/** The page for a URL no route matches. */
export class NotFoundPage {
  constructor(
    readonly page: Page,
    readonly response: Response | null,
  ) {}

  static async open(page: Page, path: string) {
    return new NotFoundPage(page, await page.goto(path));
  }

  get heading() {
    return this.page.getByRole("heading", { level: 1, name: "ページが見つかりません" });
  }

  async goToTop() {
    await this.page.getByRole("main").getByRole("link", { name: "トップに戻る" }).click();
    await expect(this.page).toHaveURL("/");
    return new TopPage(this.page);
  }
}
