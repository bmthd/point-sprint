import { type Page, expect, test } from "@playwright/test";

// The header and the footer are on every page, and their links go where they say.

/** Creates a plan from the top page and returns its id. */
async function createPlan(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  await expect(page).toHaveURL(/\/plan\?id=/);
  return new URL(page.url()).searchParams.get("id") ?? "";
}

const pages = (id: string) => [
  { name: "トップ", path: "/" },
  { name: "プロフィール", path: "/profile" },
  { name: "プラン", path: `/plan?id=${id}` },
  { name: "プランの設定", path: `/plan/settings?id=${id}` },
];

const header = (page: Page) => page.getByRole("banner");
const footer = (page: Page) => page.getByRole("contentinfo");
const topLink = (page: Page) => header(page).getByRole("link", { name: "ポイントスプリント" });
const profileLink = (page: Page) =>
  header(page).getByRole("link", { name: "プロフィール（SPU・ショップ台帳）" });

/** Waits until the page has hydrated: before that a click reloads the whole document. */
const ready = (page: Page) =>
  expect(page.getByRole("main").getByText("読み込み中…")).toHaveCount(0);

test("every page links to the top and the profile from the header", async ({ page }) => {
  const id = await createPlan(page);
  for (const { name, path } of pages(id)) {
    await test.step(name, async () => {
      await page.goto(path);
      await ready(page);
      await topLink(page).click();
      await expect(page).toHaveURL(/\/$/);

      await page.goto(path);
      await ready(page);
      await profileLink(page).click();
      await expect(page).toHaveURL(/\/profile\/?$/);
      await expect(page.getByRole("heading", { level: 1, name: "プロフィール" })).toBeVisible();
    });
  }
});

test("the header marks the page being shown", async ({ page }) => {
  const id = await createPlan(page);
  for (const { name, path } of pages(id)) {
    await test.step(name, async () => {
      await page.goto(path);
      if (path === "/") await expect(topLink(page)).toHaveAttribute("aria-current", "page");
      else await expect(topLink(page)).not.toHaveAttribute("aria-current");
      if (path === "/profile")
        await expect(profileLink(page)).toHaveAttribute("aria-current", "page");
      else await expect(profileLink(page)).not.toHaveAttribute("aria-current");
    });
  }
});

test("every page has the footer, and each footer link opens its page", async ({ page }) => {
  const id = await createPlan(page);
  for (const { name, path } of pages(id)) {
    await test.step(name, async () => {
      await page.goto(path);
      await ready(page);
      await expect(footer(page)).toContainText("このブラウザの中にだけ保存されます");
      // No link to an anchor that is not on the page, or to a page that does not exist yet.
      await expect(footer(page).locator('a[href^="#"]')).toHaveCount(0);

      const targets = await footer(page)
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      for (const href of targets) {
        await page.goto(path);
        await ready(page);
        await footer(page).locator(`a[href="${href}"]`).click();
        await expect(page).toHaveURL(new RegExp(`${href.replace(/[?]/g, "\\?")}$`));
        await expect(page.getByRole("main")).toBeVisible();
      }
    });
  }
});

test("a bar fixed to the bottom of a phone screen does not hide the footer", async ({ page }) => {
  const id = await createPlan(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [`/plan?id=${id}`, `/plan/settings?id=${id}`]) {
    await page.goto(path);
    await ready(page);
    const text = footer(page).getByText("このブラウザの中にだけ保存されます");
    await text.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // The point at the text's center is the text itself, not the bar drawn over it.
    const covered = await text.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !element.contains(top);
    });
    expect(covered, path).toBe(false);
  }
});
