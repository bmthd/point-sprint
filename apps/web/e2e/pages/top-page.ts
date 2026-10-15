import { type Locator, type Page, expect } from "@playwright/test";
import { PlanPage } from "./plan-page";
import { Footer, Header } from "./site-page";

/** The top page: the events that have not ended, and the plans. */
export class TopPage {
  readonly createPlanButton: Locator;
  readonly createPlanWithoutEventButton: Locator;

  constructor(readonly page: Page) {
    this.createPlanButton = page
      .getByRole("button", { name: "このイベントでプランを作る" })
      .first();
    this.createPlanWithoutEventButton = page.getByRole("button", {
      name: "イベントを選ばずにプランを作る",
    });
  }

  static async open(page: Page) {
    await page.goto("/");
    return new TopPage(page);
  }

  get header() {
    return new Header(this.page);
  }

  get footer() {
    return new Footer(this.page);
  }

  /** The events, the first list on the page. */
  get events() {
    return this.page.getByRole("main").getByRole("list").first().getByRole("listitem");
  }

  /** Creates a plan for the first event. */
  async createPlan() {
    await this.createPlanButton.click();
    await expect(this.page).toHaveURL(/\/plan\?id=/);
    return new PlanPage(this.page);
  }
}
