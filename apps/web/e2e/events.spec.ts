import { expect, test, fixDate } from "./fixtures";
import { TopPage } from "./pages";

// The top page reads the events from the Worker, which serves them from the event master in D1.
// The E2E tests start it from the migrations (playwright.config.ts).

test("the top page lists the events in the master that have not ended", async ({ page }) => {
  await fixDate(page, new Date("2026-10-12T12:00:00+09:00"));
  const top = await TopPage.open(page);
  await expect(top.events).toHaveCount(3);
  await expect(top.events.nth(0)).toContainText("お買い物マラソン第二弾");
  await expect(top.events.nth(0)).toContainText("開催予定");
  await expect(top.events.nth(1)).toContainText("楽天ブランドデー");
  await expect(top.events.nth(2)).toContainText("お買い物マラソン第三弾");
});

test("the marathon's page has the rounds in its HTML, before any script runs", async ({
  request,
}) => {
  const response = await request.get("/marathon");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<link rel="canonical" href="https://point-sprint.bmth.dev/marathon"/>');
  // The rounds the migrations put in have ended, whatever day the test runs on.
  expect(html).toContain("これまでの回");
  expect(html).toContain("お買い物マラソン第三弾");
  expect(html).toContain("7,000P");
});

test("plan buttons wait for hydration before accepting clicks", async ({ page }) => {
  let releaseScripts = () => {};
  const scripts = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/assets/*.js", async (route) => {
    await scripts;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "commit" });
  const top = new TopPage(page);
  try {
    await expect(top.createPlanButton).toBeVisible();
    await expect(top.createPlanButton).toBeDisabled();
    await expect(top.createPlanWithoutEventButton).toBeDisabled();
  } finally {
    releaseScripts();
  }
  await expect(top.createPlanButton).toBeEnabled();
  await expect(top.createPlanWithoutEventButton).toBeEnabled();
  await top.createPlan();
});
