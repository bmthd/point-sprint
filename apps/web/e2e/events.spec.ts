import { expect, test } from "./fixtures";
import { TopPage } from "./pages";

// The top page reads the events from the Worker, which serves them from the event master in D1.
// The E2E tests start it from the migrations (playwright.config.ts).

test("the top page lists the events in the master that have not ended", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-12T12:00:00+09:00"));
  const top = await TopPage.open(page);
  await expect(top.events).toHaveCount(3);
  await expect(top.events.nth(0)).toContainText("お買い物マラソン第二弾");
  await expect(top.events.nth(0)).toContainText("開催予定");
  await expect(top.events.nth(1)).toContainText("楽天ブランドデー");
  await expect(top.events.nth(2)).toContainText("お買い物マラソン第三弾");
});
