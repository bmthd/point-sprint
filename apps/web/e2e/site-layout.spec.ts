import { type Page, expect, test } from "./fixtures";
import { SitePage, TopPage } from "./pages";

// The header and the footer are on every page, and their links go where they say.

/** Creates a plan from the top page and returns its id. */
async function createPlan(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const plan = await (await TopPage.open(page)).createPlan();
  return plan.id;
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

/** Opens the page at `path` and waits until it shows its content. */
async function openReady(page: Page, path: string) {
  const site = await SitePage.open(page, path);
  await site.ready();
  return site;
}

// One test per page, like the footer's: the retries of every page together take more than one
// test's time allows.
for (const { name } of pages("")) {
  test(`${name} links to the top and the profile from the header, and 戻る comes back`, async ({
    page,
  }) => {
    const id = await createPlan(page);
    const path = pages(id).find((p) => p.name === name)?.path ?? "";
    await (await openReady(page, path)).header.goToTop();

    // Retried from the page: a click before the page hydrates loads the profile as a new
    // document, and 戻る then has no page to go back to.
    await expect(async () => {
      const profile = await (await openReady(page, path)).header.goToProfile();
      await expect(profile.heading).toBeVisible();
      if (path === "/profile") return;
      await profile.goBack(path, { timeout: 2000 });
    }).toPass();
  });
}

test("the header marks the page being shown", async ({ page }) => {
  const id = await createPlan(page);
  for (const { name, path } of pages(id)) {
    await test.step(name, async () => {
      const { header } = await SitePage.open(page, path);
      if (path === "/") await expect(header.topLink).toHaveAttribute("aria-current", "page");
      else await expect(header.topLink).not.toHaveAttribute("aria-current");
      if (path === "/profile")
        await expect(header.profileLink).toHaveAttribute("aria-current", "page");
      else await expect(header.profileLink).not.toHaveAttribute("aria-current");
    });
  }
});

test("on a phone the header has the site name, the color mode and the menu, which has the profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { header } = await openReady(page, "/help");
  await expect(header.profileLink).toBeHidden();
  await expect(header.colorModeButton).toBeVisible();
  const box = (await header.topLink.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(44);

  const menu = await header.openMenu();
  await menu.goToProfile();
  await expect(menu.root).toHaveCount(0);
});

for (const width of [390, 1280]) {
  test(`at ${width}px the color mode switch keeps only a choice against the device`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    const { header } = await openReady(page, "/help");
    const html = page.locator("html");
    const stored = () => page.evaluate(() => localStorage.getItem("color-mode"));
    await expect(html).toHaveAttribute("data-mode", "dark");

    // Against the device: kept, and the device no longer decides.
    await header.switchColorMode();
    await expect(html).toHaveAttribute("data-mode", "light");
    expect(await stored()).toBe("light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveAttribute("data-mode", "light");

    // Back to what the device makes: the site follows the device again.
    await header.switchColorMode();
    await expect(html).toHaveAttribute("data-mode", "dark");
    expect(await stored()).toBe("system");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).toHaveAttribute("data-mode", "light");
  });
}

// One test per page: together they follow dozens of links, more than one test's time allows.
for (const { name } of pages("")) {
  test(`${name} has the footer, and each footer link opens its page`, async ({ page }) => {
    const id = await createPlan(page);
    const path = pages(id).find((p) => p.name === name)?.path ?? "";
    const { footer } = await openReady(page, path);
    await expect(footer.root).toContainText("このブラウザの中にだけ保存されます");
    // No link to an anchor that is not on the page, or to a page that does not exist yet.
    await expect(footer.root.locator('a[href^="#"]')).toHaveCount(0);

    for (const href of await footer.linkTargets()) {
      // Retried from the page: a click while the page hydrates can do nothing.
      let target: SitePage | undefined;
      await expect(async () => {
        target = await (await openReady(page, path)).footer.follow(href, { timeout: 2000 });
      }).toPass();
      await expect(target!.main).toBeVisible();
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
    let target: SitePage | undefined;
    await expect(async () => {
      target = await (await openReady(page, "/")).footer.goTo(label, path, { timeout: 2000 });
    }).toPass();
    await expect(target!.heading(heading)).toBeVisible();
  }
});

test("a bar fixed to the bottom of a phone screen does not hide the footer", async ({ page }) => {
  const id = await createPlan(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [`/plan?id=${id}`, `/plan/settings?id=${id}`]) {
    const site = await openReady(page, path);
    await expect(site.bottomBar).toBeVisible();
    const text = site.footer.root.getByText("このブラウザの中にだけ保存されます");
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
