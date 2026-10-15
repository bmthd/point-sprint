import { type Page } from "@playwright/test";
import { Header } from "./site-page";

/** A plan's settings, on their own page. */
export class PlanSettingsPage {
  constructor(readonly page: Page) {}

  static async open(page: Page, id: string) {
    await page.goto(`/plan/settings?id=${id}`);
    return new PlanSettingsPage(page);
  }

  get header() {
    return new Header(this.page);
  }
}
