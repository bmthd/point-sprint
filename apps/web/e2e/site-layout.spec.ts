import { type Page, expect, test } from "./fixtures";

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
  { name: "使い方・注意事項", path: "/help" },
  { name: "利用規約", path: "/terms" },
  { name: "プライバシーポリシー", path: "/privacy" },
  { name: "お問い合わせ", path: "/inquiry" },
  { name: "お知らせ", path: "/notices" },
];

const header = (page: Page) => page.getByRole("banner");
const footer = (page: Page) => page.getByRole("contentinfo");
const topLink = (page: Page) => header(page).getByRole("link", { name: "ポイントスプリント" });
const profileLink = (page: Page) =>
  header(page).getByRole("link", { name: "プロフィール", exact: true });

/** Waits until the page shows its content: a plan's page shows it once the plan has loaded. */
const ready = async (page: Page) => {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText("読み込み中…")).toHaveCount(0);
};

// One test per page, like the footer's: the retries of every page together take more than one
// test's time allows.
for (const { name } of pages("")) {
  test(`${name} links to the top and the profile from the header, and 戻る comes back`, async ({
    page,
  }) => {
    const id = await createPlan(page);
    const path = pages(id).find((p) => p.name === name)?.path ?? "";
    await page.goto(path);
    await ready(page);
    await topLink(page).click();
    await expect(page).toHaveURL(/\/$/);

    // Retried from the page: a click before the page hydrates loads the profile as a new
    // document, and 戻る then has no page to go back to.
    await expect(async () => {
      await page.goto(path);
      await ready(page);
      await profileLink(page).click();
      await expect(page).toHaveURL(/\/profile\/?$/);
      await expect(page.getByRole("heading", { level: 1, name: "プロフィール" })).toBeVisible();
      if (path === "/profile") return;
      await page.getByRole("link", { name: "戻る" }).click();
      // The preview server answers a page's path with its directory (`/help/`).
      await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}/?$`), {
        timeout: 2000,
      });
    }).toPass();
  });
}

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

test("on a phone the header has the site name and the menu, which has the profile and the color mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  await ready(page);
  await expect(profileLink(page)).toBeHidden();
  const box = (await topLink(page).boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(44);

  const menu = page.getByRole("dialog", { name: "メニュー" });
  // Retried: a click before the page hydrates does nothing.
  await expect(async () => {
    await header(page).getByRole("button", { name: "メニュー" }).click();
    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
  const dark = menu.getByRole("switch", { name: "ダークモード" });
  // The switch's input is hidden under its look: a person clicks the label.
  await menu.getByText("ダークモード").click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(dark).toBeChecked();

  await menu.getByRole("link", { name: "プロフィール", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/?$/);
  await expect(menu).toHaveCount(0);
});

// One test per page: together they follow dozens of links, more than one test's time allows.
for (const { name } of pages("")) {
  test(`${name} has the footer, and each footer link opens its page`, async ({ page }) => {
    const id = await createPlan(page);
    const path = pages(id).find((p) => p.name === name)?.path ?? "";
    await page.goto(path);
    await ready(page);
    await expect(footer(page)).toContainText("このブラウザの中にだけ保存されます");
    // No link to an anchor that is not on the page, or to a page that does not exist yet.
    await expect(footer(page).locator('a[href^="#"]')).toHaveCount(0);

    const targets = await footer(page)
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    for (const href of targets) {
      // Retried from the page: a click while the page hydrates can do nothing.
      await expect(async () => {
        await page.goto(path);
        await ready(page);
        await footer(page).locator(`a[href="${href}"]`).click();
        // The preview server answers a page's path with its directory (`/help/`).
        await expect(page).toHaveURL(new RegExp(`${href.replace(/[?]/g, "\\?")}/?$`), {
          timeout: 2000,
        });
      }).toPass();
      await expect(page.getByRole("main")).toBeVisible();
    }
  });
}

test("the footer links to each page that tells about the site", async ({ page }) => {
  for (const { label, path, heading } of [
    { label: "お知らせ", path: "/notices", heading: "お知らせ" },
    { label: "使い方・注意事項", path: "/help", heading: "使い方・注意事項" },
    { label: "利用規約", path: "/terms", heading: "利用規約" },
    { label: "プライバシーポリシー", path: "/privacy", heading: "プライバシーポリシー" },
  ]) {
    // Retried from the page: a click while the page hydrates can do nothing.
    await expect(async () => {
      await page.goto("/");
      await ready(page);
      await footer(page).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}/?$`), { timeout: 2000 });
    }).toPass();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("a bar fixed to the bottom of a phone screen does not hide the footer", async ({ page }) => {
  const id = await createPlan(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [`/plan?id=${id}`, `/plan/settings?id=${id}`]) {
    await page.goto(path);
    await ready(page);
    await expect(page.locator("[data-bottom-bar]")).toBeVisible();
    const text = footer(page).getByText("このブラウザの中にだけ保存されます");
    // Retried: the page can still be laying out and put the scroll back to the top.
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // The point at the text's center is the text itself, not the bar drawn over it.
      const covered = await text.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return !element.contains(top);
      });
      expect(covered, path).toBe(false);
    }).toPass();
  }
});
