import { type Locator, type Page, expect } from "@playwright/test";
import { Footer, Header } from "./site-page";

/** The form that adds an order, at the end of the list on a wide screen. */
export class AddOrderForm {
  readonly root: Locator;
  readonly shop: Locator;
  readonly newShopName: Locator;
  readonly itemUrl: Locator;
  readonly itemName: Locator;
  readonly price: Locator;
  readonly shopRate: Locator;
  readonly submit: Locator;

  constructor(
    readonly page: Page,
    orders: Locator,
  ) {
    this.root = orders.locator("form");
    this.shop = this.root.getByRole("combobox", { name: "ショップ", exact: true });
    this.newShopName = this.root.getByRole("textbox", { name: "新しいショップの名前" });
    this.itemUrl = this.root.getByRole("textbox", { name: /^商品のURL/ });
    this.itemName = this.root.getByRole("textbox", { name: "商品名メモ" });
    this.price = this.root.getByRole("textbox", { name: "金額（税込）" });
    this.shopRate = this.root.getByRole("textbox", { name: "ショップ独自倍率" });
    this.submit = this.root.getByRole("button", { name: "追加する" });
  }

  /** Chooses a new shop and names it. */
  async newShop(name: string) {
    await this.shop.selectOption({ label: "＋ 新しいショップ" });
    await this.newShopName.fill(name);
  }

  /** Pastes `url` into the item's URL field from the clipboard. */
  async pasteItemUrl(url: string) {
    await this.itemUrl.focus();
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await this.page.evaluate((value) => navigator.clipboard.writeText(value), url);
    await this.page.keyboard.press("ControlOrMeta+V");
  }

  /** Types `url` into the item's URL field and leaves it. */
  async typeItemUrl(url: string) {
    await this.itemUrl.fill(url);
    await this.itemUrl.blur();
  }

  get autofillError() {
    return this.root.getByText(/^自動入力できませんでした/);
  }
}

/** The settings of a plan, in a dialog over the plan's page. */
export class PlanSettingsDialog {
  readonly root: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("dialog", { name: "プランの設定" });
  }

  /** An SPU tile, such as `楽天モバイル +4倍`. */
  spuTile(name: string) {
    return this.root.getByRole("checkbox", { name });
  }

  /** A campaign's switch, by the start of its name. */
  campaign(name: string) {
    return this.root
      .getByRole("region", { name: "キャンペーン" })
      .getByRole("switch", { name: new RegExp(`^${name}`) });
  }

  /** Taps a card (an SPU tile, a campaign) on its label: its input is visually hidden. */
  async tap(card: Locator) {
    await card.locator("xpath=ancestor::label[1]").click();
  }
}

/** A plan: its orders, and the points they earn. */
export class PlanPage {
  readonly orders: Locator;
  readonly addForm: AddOrderForm;
  readonly summary: Locator;
  readonly breakdown: Locator;
  /** The right column on a wide screen. */
  readonly resultColumn: Locator;
  readonly shareResultButton: Locator;

  constructor(readonly page: Page) {
    this.orders = page.getByRole("region", { name: "注文のリスト" });
    this.addForm = new AddOrderForm(page, this.orders);
    this.summary = page.getByRole("region", { name: "サマリー" });
    this.breakdown = page.getByRole("list", { name: "ポイントの内訳" });
    this.resultColumn = page.getByRole("complementary", { name: "結果" });
    this.shareResultButton = page.getByRole("button", { name: "結果をシェア" });
  }

  static async open(page: Page, id: string) {
    await page.goto(`/plan?id=${id}`);
    return new PlanPage(page);
  }

  get id() {
    return new URL(this.page.url()).searchParams.get("id") ?? "";
  }

  get header() {
    return new Header(this.page);
  }

  get footer() {
    return new Footer(this.page);
  }

  get name() {
    return this.page.getByRole("heading", { level: 1 });
  }

  /** The points struck through, of the orders not counted. */
  get struckPoints() {
    return this.orders.locator("s");
  }

  /** Adds an order from a new shop. */
  async addOrder(shop: string, price: string) {
    await this.addForm.newShop(shop);
    await this.addForm.price.fill(price);
    await this.addForm.submit.click();
    await expect(this.orders).toContainText(shop);
  }

  /** The shop of each order, `店A` or `店B`, in the list's order. */
  orderShops() {
    return this.orders
      .locator("li[data-order-id]")
      .evaluateAll((rows) => rows.map((row) => row.textContent?.match(/店[AB]/)?.[0]));
  }

  /** Moves the shop's order up the list with the keyboard. */
  async moveOrderUp(shop: string) {
    await this.page.getByRole("button", { name: `${shop}の注文を並べ替え` }).press("ArrowUp");
  }

  /** The switch that counts the shop's order as bought. */
  counted(shop: string) {
    return this.orders.getByRole("switch", { name: `${shop}の注文を購入決定` });
  }

  /** The input itself is visually hidden; a click lands on the track drawn in its label. */
  async toggleCounted(shop: string) {
    await this.counted(shop).locator("xpath=ancestor::label[1]").click();
  }

  async openSettings() {
    await this.page.getByRole("button", { name: /^プランの設定/ }).click();
    const settings = new PlanSettingsDialog(this.page);
    await expect(settings.root).toBeVisible();
    return settings;
  }

  /** Opens the result's share links. */
  async shareResult() {
    await this.shareResultButton.click();
  }

  shareLink(name: string) {
    return this.page.getByRole("link", { name });
  }

  async reload() {
    await this.page.reload();
    return new PlanPage(this.page);
  }
}
