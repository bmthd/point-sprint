import { type Page } from "@playwright/test";
import { Sidebar } from "./site-page";

/** /notices: every notice in full. */
export class NoticesPage {
  constructor(readonly page: Page) {}

  static async open(page: Page) {
    await page.goto("/notices");
    return new NoticesPage(page);
  }

  get sidebar() {
    return new Sidebar(this.page);
  }

  /** The newest notice. */
  get latest() {
    return this.page.getByRole("main").getByRole("article").first();
  }

  notice(id: string) {
    return this.page.locator(`#${id}`);
  }
}
