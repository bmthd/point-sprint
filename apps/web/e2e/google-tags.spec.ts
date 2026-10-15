import { type Page, expect, test } from "./fixtures";
import { TopPage } from "./pages";

// What gtag() pushed: the inline snippet queues each call's arguments in `dataLayer`.
const gtagCalls = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer.map((args) =>
      Array.from(args),
    ),
  );

test("loads gtag.js and AdSense and configures GA once without manual page views", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });

  const googleRequests: string[] = [];
  page.on("request", (request) => {
    if (/googletagmanager|googlesyndication/.test(request.url()))
      googleRequests.push(request.url());
  });

  const top = await TopPage.open(page);
  const profile = await top.header.goToProfile();
  await expect(profile.heading).toBeVisible();

  // Each script was loaded once, and navigating did not load or run them again.
  expect(googleRequests.toSorted()).toEqual([
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8953986206743618",
    "https://www.googletagmanager.com/gtag/js?id=G-B6CYR6VF70",
  ]);
  // The config call counts the first load. Later page views come from GA4 Enhanced measurement
  // (history changes), so the app itself sends no page_view.
  const calls = await gtagCalls(page);
  expect(calls.filter((call) => call[0] === "config")).toEqual([["config", "G-B6CYR6VF70"]]);
  expect(calls.filter((call) => call.includes("page_view"))).toEqual([]);

  expect(problems).toEqual([]);
});

test("serves ads.txt for the AdSense publisher", async ({ request }) => {
  const response = await request.get("/ads.txt");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain(
    "google.com, pub-8953986206743618, DIRECT, f08c47fec0942fa0",
  );
});
