import { type Page, expect, test } from "./fixtures";

// The top page lists the events that have not ended. The HTML rendered at build time lists them as
// of the day of the build, so that the list does not change once the page runs.

/** The events, the first list on the top page. */
const events = (page: Page) =>
  page.getByRole("main").getByRole("list").first().getByRole("listitem");

test("the HTML rendered at build time lists the events the running page shows", async ({
  browser,
  page,
}) => {
  const html = await browser.newPage({ javaScriptEnabled: false });
  await html.goto("/");
  const ahead = await events(html).allInnerTexts();
  await html.close();
  expect(ahead.length).toBeGreaterThan(0);

  await page.goto("/");
  // Enabled once the page runs and has read the profile.
  await expect(page.getByRole("button", { name: "イベントを選ばずにプランを作る" })).toBeEnabled();
  expect(await events(page).allInnerTexts()).toEqual(ahead);
});
