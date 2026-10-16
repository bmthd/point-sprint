import { type Locator, type Page, expect } from "@playwright/test";
import { InquiryPage } from "./inquiry-page";
import { NoticesPage } from "./notices-page";
import { ProfilePage } from "./profile-page";
import { TopPage } from "./top-page";

/** Matches a URL that ends with `path`: the preview server answers a page's path with its directory (`/help/`). */
export const endsWithPath = (path: string) => new RegExp(`${path.replace(/[?]/g, "\\?")}/?$`);

/** Options for a navigation that a test retries: how long to wait for the next page's URL. */
export type NavigationOptions = { timeout?: number };

/** The header, on every page. */
export class Header {
  readonly root: Locator;
  readonly topLink: Locator;
  readonly profileLink: Locator;
  readonly menuButton: Locator;
  readonly colorModeButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("banner");
    this.topLink = this.root.getByRole("link", { name: "ポイントスプリント" });
    this.profileLink = this.root.getByRole("link", { name: "プロフィール", exact: true });
    this.menuButton = this.root.getByRole("button", { name: "メニュー" });
    this.colorModeButton = this.root.getByRole("button", { name: /^カラーモード/ });
  }

  async goToTop() {
    await this.topLink.click();
    await expect(this.page).toHaveURL(/\/$/);
    return new TopPage(this.page);
  }

  async goToProfile() {
    await this.profileLink.click();
    await expect(this.page).toHaveURL(endsWithPath("/profile"));
    return new ProfilePage(this.page);
  }

  /** Switches between light and dark. Retried: a click before the prerendered page hydrates does nothing. */
  async switchColorMode() {
    const html = this.page.locator("html");
    const before = await html.getAttribute("data-mode");
    await expect(async () => {
      await this.colorModeButton.click();
      await expect(html).not.toHaveAttribute("data-mode", before ?? "", { timeout: 1000 });
    }).toPass();
  }

  /** Opens the menu, on a phone. Retried: a click before the prerendered page hydrates does nothing. */
  async openMenu() {
    const menu = new Menu(this.page);
    await expect(async () => {
      await this.menuButton.click();
      await expect(menu.root).toBeVisible({ timeout: 1000 });
    }).toPass();
    return menu;
  }
}

/** The header's menu, on a phone: the profile and the sidebar. */
export class Menu {
  readonly root: Locator;
  readonly profileLink: Locator;
  readonly shareSite: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("dialog", { name: "メニュー" });
    this.profileLink = this.root.getByRole("link", { name: "プロフィール", exact: true });
    this.shareSite = this.root.getByRole("region", { name: "このサイトをシェア" });
  }

  /** A notice's headline. */
  headline(title: string) {
    return this.root.getByRole("link", { name: title });
  }

  async goToProfile() {
    await this.profileLink.click();
    await expect(this.page).toHaveURL(endsWithPath("/profile"));
    return new ProfilePage(this.page);
  }

  /** Follows a notice's headline to the notice on /notices. */
  async goToNotice(title: string, id: string) {
    await this.headline(title).click();
    await expect(this.page).toHaveURL(new RegExp(`/notices/?#${id}$`));
    return new NoticesPage(this.page);
  }
}

/** The footer, on every page. */
export class Footer {
  readonly root: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("contentinfo");
  }

  /** The `href` of every link. */
  linkTargets() {
    return this.root
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  }

  /** Follows the link to `href`. */
  async follow(href: string, options?: NavigationOptions) {
    await this.root.locator(`a[href="${href}"]`).click();
    await expect(this.page).toHaveURL(endsWithPath(href), options);
    return new SitePage(this.page);
  }

  /** Follows the link named `name`, which goes to `path`. */
  async goTo(name: string, path: string, options?: NavigationOptions) {
    await this.root.getByRole("link", { name }).click();
    await expect(this.page).toHaveURL(endsWithPath(path), options);
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
  readonly headlines: Locator;
  readonly shareSite: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("complementary", { name: "サイドバー" });
    this.headlines = this.root.getByRole("region", { name: "お知らせ" });
    this.shareSite = this.root.getByRole("region", { name: "このサイトをシェア" });
  }
}

/** Any page of the site, for what every page has: the header, the footer and the sidebar. */
export class SitePage {
  constructor(readonly page: Page) {}

  static async open(page: Page, path: string) {
    await page.goto(path);
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
