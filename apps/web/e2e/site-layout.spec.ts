import { type Page, expect, test, fixDate } from "./fixtures.ts";
import { SitePage, TopPage } from "./pages/index.ts";
import { endsWithPath } from "./pages/site-page.ts";

// The header and the footer are on every page, and their links go where they say.

/** Creates a plan from the top page and returns its id. */
async function createPlan(page: Page) {
  await fixDate(page, new Date("2026-10-05T12:00:00+09:00"));
  const plan = await (await TopPage.open(page)).createPlan();
  return plan.id;
}

const pages = (id: string) => [
  { name: "トップ", path: "/" },
  { name: "共通設定", path: "/settings" },
  { name: "プラン", path: `/plan?id=${id}` },
  { name: "プランの設定", path: `/plan/settings?id=${id}` },
  { name: "月ごとの SPU", path: "/spu?month=2026-10" },
  { name: "このサイトについて", path: "/about" },
  { name: "使い方", path: "/help" },
  { name: "利用規約", path: "/terms" },
  { name: "プライバシーポリシー", path: "/privacy" },
  { name: "お問い合わせ", path: "/inquiry" },
  { name: "お知らせ", path: "/notices" },
  { name: "マラソンの日程と上限", path: "/marathon" },
];

/** Opens the page at `path` and waits until it shows its content. */
async function openReady(page: Page, path: string) {
  const site = await SitePage.open(page, path);
  await site.ready();
  return site;
}

// One test per page, like the footer's: every page together takes more than one test's time allows.
for (const { name } of pages("")) {
  test(`${name} links to the top and 共通設定 from the header, and 戻る comes back`, async ({
    page,
  }) => {
    const id = await createPlan(page);
    const path = pages(id).find((p) => p.name === name)?.path ?? "";
    await (await openReady(page, path)).header.goToTop();

    const settings = await (await openReady(page, path)).header.goToSettings();
    await expect(settings.heading).toBeVisible();
    if (path === "/settings") return;
    await settings.goBack(path);
  });
}

// One test per page, like the footer's: every page together takes more than one test's time allows.
for (const { name } of pages("")) {
  test(`the header marks ${name} as the page being shown`, async ({ page }) => {
    const { header } = await openPage(page, name);
    if (name === "トップ") await expect(header.topLink).toHaveAttribute("aria-current", "page");
    else await expect(header.topLink).not.toHaveAttribute("aria-current");
    if (name === "共通設定")
      await expect(header.settingsLink).toHaveAttribute("aria-current", "page");
    else await expect(header.settingsLink).not.toHaveAttribute("aria-current");
  });
}

test("on a wide screen the header's menus open on a pointer and on the keyboard, and their names go to their pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { header } = await openReady(page, "/");
  await expect(header.root.getByRole("link", { name: "月ごとの SPU" })).toBeHidden();
  await header.marathonLink.hover();
  await expect(header.root.getByRole("link", { name: "日程と上限" })).toBeVisible();
  await expect(header.root.getByRole("link", { name: "月ごとの SPU" })).toBeVisible();

  await header.guidesLink.focus();
  await expect(header.helpLink).toBeVisible();
  await expect(header.root.getByRole("link", { name: "買い物ガイド" })).toBeVisible();

  await header.guidesLink.click();
  await expect(page).toHaveURL(endsWithPath("/guides"));
  await expect(new SitePage(page).heading("買い物ガイド")).toBeVisible();
  await expect(header.guidesLink).toHaveAttribute("aria-current", "page");

  await header.guidesLink.hover();
  await header.helpLink.click();
  await expect(page).toHaveURL(endsWithPath("/help"));
  await expect(new SitePage(page).heading("使い方")).toBeVisible();
  await expect(header.helpLink).toHaveAttribute("aria-current", "page");
});

test("on a phone the header has the site name, the guides, the color mode and the menu, which has 共通設定 and サイトの案内", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { header } = await openReady(page, "/help");
  await expect(header.settingsLink).toBeHidden();
  await expect(header.marathonLink).toBeHidden();
  await expect(header.guidesLink).toBeVisible();
  await expect(header.colorModeButton).toBeVisible();
  const box = (await header.topLink.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(44);

  const menu = await header.openMenu();
  await menu.goToSettings();
  await expect(menu.root).toHaveCount(0);

  for (const { name, path, heading } of [
    {
      name: "お買い物マラソンの日程と上限",
      path: "/marathon",
      heading: "お買い物マラソンの日程と上限",
    },
    { name: "月ごとの SPU", path: "/spu", heading: undefined },
    { name: "買い物ガイド", path: "/guides", heading: "買い物ガイド" },
    { name: "使い方", path: "/help", heading: "使い方" },
  ]) {
    await (await header.openMenu()).siteGuide.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}/?(\\?.*)?$`));
    if (heading) await expect(new SitePage(page).heading(heading)).toBeVisible();
  }
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

/** Where the footer's links in the site go, in their order: ソースコード leaves the site. */
const footerTargets = [
  "/about",
  "/guides/rakuten-point-calculator-comparison",
  "/inquiry",
  "/terms",
  "/privacy",
];

/** Opens the page named `name`, with a plan to show if it is one of a plan's pages. */
async function openPage(page: Page, name: string) {
  const needsPlan = pages("").some((p) => p.name === name && p.path.includes("id="));
  const id = needsPlan ? await createPlan(page) : "";
  return openReady(page, pages(id).find((p) => p.name === name)?.path ?? "");
}

for (const { name } of pages("")) {
  test(`${name} has the footer`, async ({ page }) => {
    const { footer } = await openPage(page, name);
    await expect(footer.root).toContainText("このブラウザの中に保存されます");
    await expect(footer.root).toContainText("ポイントスプリントは個人開発のサイトです。");
    await expect(footer.root).toContainText("© 2026 じょうげん");
    // No link to an anchor that is not on the page, or to a page that does not exist yet.
    await expect(footer.root.locator('a[href^="#"]')).toHaveCount(0);
    expect(await footer.linkTargets()).toEqual(footerTargets);
  });

  // One test per link: each loads two pages, and the links of a page together take more than one
  // test's time allows.
  for (const href of footerTargets) {
    test(`${name}'s footer link to ${href} opens its page`, async ({ page }) => {
      const target = await (await openPage(page, name)).footer.follow(href);
      await expect(target.main).toBeVisible();
    });
  }
}

test("the footer links to each page that tells about the site", async ({ page }) => {
  for (const { label, path, heading } of [
    { label: "このサイトについて", path: "/about", heading: "このサイトについて" },
    { label: "お問い合わせ", path: "/inquiry", heading: "お問い合わせ" },
    { label: "利用規約", path: "/terms", heading: "利用規約" },
    { label: "プライバシーポリシー", path: "/privacy", heading: "プライバシーポリシー" },
  ]) {
    const target = await (await openReady(page, "/")).footer.goTo(label, path);
    await expect(target.heading(heading)).toBeVisible();
  }
});

test("a bar fixed to the bottom of a phone screen does not hide the footer", async ({ page }) => {
  const id = await createPlan(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [`/plan?id=${id}`, `/plan/settings?id=${id}`]) {
    const site = await openReady(page, path);
    await expect(site.bottomBar).toBeVisible();
    const text = site.footer.root.getByText("このブラウザの中に保存されます");
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
