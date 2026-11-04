import { type Locator, type Page, expect } from "@playwright/test";
import { PlanPage } from "./plan-page";
import { Footer, Header } from "./site-page";

/** The top page: the events that have not ended, and the plans. */
export class TopPage {
  readonly createPlanButton: Locator;
  readonly createPlanWithoutEventButton: Locator;
  readonly startButton: Locator;

  constructor(readonly page: Page) {
    // When no event is ahead, the latest ended one is offered under its own label.
    this.createPlanButton = page
      .locator("#events")
      .getByRole("button", { name: /^(プランを作る|この条件で計算)$/ })
      .first();
    this.createPlanWithoutEventButton = page.getByRole("button", {
      name: "イベントを選ばずにプランを作る",
    });
    this.startButton = page.getByRole("button", { name: "計算をはじめる" });
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

  /** The events' cards. */
  get events() {
    return this.page.locator("#events").getByRole("list").first().getByRole("listitem");
  }

  /** Creates a plan for the first event. */
  async createPlan() {
    await this.createPlanButton.click();
    await expect(this.page).toHaveURL(/\/plan\?id=/);
    const plan = new PlanPage(this.page);
    // The top page's heading stays until the plan's replaces it.
    await expect(plan.orders).toBeVisible();
    return plan;
  }
}
