import { type Locator, type Page, expect } from "@playwright/test";
import { InquiryPage } from "./inquiry-page.ts";
import { NoticesPage } from "./notices-page.ts";
import { SettingsPage } from "./settings-page.ts";
import { TopPage } from "./top-page.ts";
import { hydrated, openHydrated } from "./hydration.ts";

/** Matches a URL that ends with `path`: the preview server answers a page's path with its directory (`/help/`). */
export function endsWithPath(path: string) {
  return new RegExp(`${path.replace(/[?]/g, "\\?")}/?$`);
}

/** The header, on every page. */
export class Header {
  readonly root: Locator;
  readonly topLink: Locator;
  readonly settingsLink: Locator;
  /** On a wide screen, the name of a menu: the link that opens it. */
  readonly marathonLink: Locator;
  /** On a wide screen, the name of a menu: the link that opens it. */
  readonly guidesLink: Locator;
  /** In the ガイド menu, on a wide screen. */
  readonly helpLink: Locator;
  /** Named `お知らせ（未読あり）` while a notice has not been read. */
  readonly noticesLink: Locator;
  /** Named `メニュー（未読のお知らせあり）` while a notice has not been read. */
  readonly menuButton: Locator;
  readonly colorModeButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("banner");
    this.topLink = this.root.getByRole("link", { name: "ポイントスプリント" });
    this.settingsLink = this.root.getByRole("link", { name: "共通設定", exact: true });
    this.marathonLink = this.root.getByRole("link", { name: "お買い物マラソン", exact: true });
    this.guidesLink = this.root.getByRole("link", { name: "ガイド", exact: true });
    this.helpLink = this.root.getByRole("link", { name: "使い方", exact: true });
    this.noticesLink = this.root.getByRole("link", { name: /^お知らせ/ });
    this.menuButton = this.root.getByRole("button", { name: /^メニュー/ });
    this.colorModeButton = this.root.getByRole("button", { name: /^カラーモード/ });
  }

  async goToTop() {
    await this.topLink.click();
    await expect(this.page).toHaveURL(/\/$/);
    await hydrated(this.page);
    return new TopPage(this.page);
  }

  async goToSettings() {
    await this.settingsLink.click();
    await expect(this.page).toHaveURL(endsWithPath("/settings"));
    await hydrated(this.page);
    return new SettingsPage(this.page);
  }

  /** Switches between light and dark. */
  async switchColorMode() {
    const html = this.page.locator("html");
    const before = await html.getAttribute("data-mode");
    await this.colorModeButton.click();
    await expect(html).not.toHaveAttribute("data-mode", before ?? "");
  }

  /** Opens the menu, on a phone. */
  async openMenu() {
    const menu = new Menu(this.page);
    await this.menuButton.click();
    await expect(menu.root).toBeVisible();
    return menu;
  }
}

/** The header's menu, on a phone: 共通設定, お知らせ, then the groups of its `Sidebar`, which start with サイトの案内. */
export class Menu {
  readonly root: Locator;
  readonly settingsLink: Locator;
  /** Named `お知らせ（未読あり）` while a notice has not been read. */
  readonly noticesLink: Locator;
  readonly siteGuide: Locator;
  readonly helpLink: Locator;
  readonly recentArticles: Locator;
  readonly shareSite: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("dialog", { name: "メニュー" });
    this.settingsLink = this.root.getByRole("link", { name: "共通設定", exact: true });
    this.noticesLink = this.root.getByRole("link", { name: /^お知らせ/ });
    this.siteGuide = this.root.getByRole("group", { name: "サイトの案内" });
    this.helpLink = this.siteGuide.getByRole("link", { name: "使い方", exact: true });
    this.recentArticles = this.root.getByRole("group", { name: "最近更新された記事" });
    this.shareSite = this.root.getByRole("group", { name: "このサイトをシェア" });
  }

  async goToSettings() {
    await this.settingsLink.click();
    await expect(this.page).toHaveURL(endsWithPath("/settings"));
    await hydrated(this.page);
    return new SettingsPage(this.page);
  }

  async goToNotices() {
    await this.noticesLink.click();
    await expect(this.page).toHaveURL(endsWithPath("/notices"));
    await hydrated(this.page);
    return new NoticesPage(this.page);
  }
}

/** The footer, on every page. */
export class Footer {
  readonly root: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("contentinfo");
  }

  /** The `href` of every link to a page of the site (not the source code or the Rakuten credit, which leave it). */
  linkTargets() {
    return this.root
      .getByRole("navigation", { name: "サイトの情報" })
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  }

  /** Follows the link to `href`. */
  async follow(href: string) {
    await this.root.locator(`a[href="${href}"]`).click();
    await expect(this.page).toHaveURL(endsWithPath(href));
    await hydrated(this.page);
    return new SitePage(this.page);
  }

  /** Follows the link named `name`, which goes to `path`. */
  async goTo(name: string, path: string) {
    await this.root.getByRole("link", { name }).click();
    await expect(this.page).toHaveURL(endsWithPath(path));
    await hydrated(this.page);
    return new SitePage(this.page);
  }

  async goToInquiry() {
    await this.goTo("お問い合わせ", "/inquiry");
    return new InquiryPage(this.page);
  }
}

/** The sidebar, beside the content of the pages that read on a wide screen. */
export class Sidebar {
  readonly root: Locator;
  readonly recentArticles: Locator;
  readonly shareSite: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("complementary", { name: "サイドバー" });
    this.recentArticles = this.root.getByRole("region", { name: "最近更新された記事" });
    this.shareSite = this.root.getByRole("region", { name: "このサイトをシェア" });
  }
}

/** Any page of the site, for what every page has: the header, the footer and the sidebar. */
export class SitePage {
  constructor(readonly page: Page) {}

  static async open(page: Page, path: string) {
    await openHydrated(page, path);
    return new SitePage(page);
  }

  get header() {
    return new Header(this.page);
  }

  get footer() {
    return new Footer(this.page);
  }

  get sidebar() {
    return new Sidebar(this.page);
  }

  get main() {
    return this.page.getByRole("main");
  }

  /** The bar fixed to the bottom of a phone screen, on a plan's pages. */
  get bottomBar() {
    return this.page.locator("[data-bottom-bar]");
  }

  heading(name: string) {
    return this.page.getByRole("heading", { level: 1, name });
  }

  /** Waits until the page shows its content: a plan's page shows it once the plan has loaded. */
  async ready() {
    await expect(this.main).toBeVisible();
    await expect(this.page.getByText("読み込み中…")).toHaveCount(0);
  }
}
