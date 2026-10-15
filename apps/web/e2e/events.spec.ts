import { expect, test } from "./fixtures";
import { TopPage } from "./pages";

// The top page lists the events that have not ended. The HTML rendered at build time lists them as
// of the day of the build, so that the list does not change once the page runs.

test("the HTML rendered at build time lists the events the running page shows", async ({
  browser,
  page,
}) => {
  const html = await TopPage.open(await browser.newPage({ javaScriptEnabled: false }));
  const ahead = await html.events.allInnerTexts();
  await html.page.close();
  expect(ahead.length).toBeGreaterThan(0);

  const top = await TopPage.open(page);
  // Enabled once the page runs and has read the profile.
  await expect(top.createPlanWithoutEventButton).toBeEnabled();
  expect(await top.events.allInnerTexts()).toEqual(ahead);
});
