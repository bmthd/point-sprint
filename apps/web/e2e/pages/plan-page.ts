import { type Locator, type Page, expect } from "@playwright/test";
import { Footer, Header } from "./site-page.ts";

/** The empty row that adds an order, at the end of the list on a wide screen. */
export class AddOrderForm {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly shop: Locator;
  readonly itemUrl: Locator;
  readonly itemName: Locator;
  readonly price: Locator;
  readonly shopRate: Locator;

  constructor(
    readonly page: Page,
    orders: Locator,
  ) {
    const toggle = page.getByRole("button", { name: "新しい注文の条件" });
    this.root = orders.getByRole("listitem").filter({ has: toggle });
    this.toggle = this.root.getByRole("button", { name: "新しい注文の条件" });
    // Typed to find a saved shop, or to name a new one.
    this.shop = this.root.getByRole("textbox", { name: /^ショップ/ });
    this.itemUrl = this.root.getByRole("textbox", { name: "商品ページのURL" });
    this.itemName = this.root.getByRole("textbox", { name: "新しい注文の商品名" });
    this.price = this.root.getByRole("textbox", { name: "新しい注文の金額" });
    this.shopRate = this.root.getByRole("spinbutton", { name: /^独自倍率/ });
  }

  /** Opens the new order's conditions: its shop, URL, shop rate, date and campaigns. */
  async openConditions() {
    if ((await this.toggle.getAttribute("aria-expanded")) === "true") return;
    await this.toggle.click();
  }

  /** Names a new shop: a name no saved shop has makes one. */
  async newShop(name: string) {
    await this.openConditions();
    await this.shop.fill(name);
  }

  /** Makes the typed order with ⌘ (Ctrl) + Enter in its amount. */
  async add() {
    await this.price.focus();
    await this.page.keyboard.press("ControlOrMeta+Enter");
  }

  /** Pastes `url` into the item's name from the clipboard, which looks the item up. */
  async pasteItemUrl(url: string) {
    await this.itemName.focus();
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await this.page.evaluate((value) => navigator.clipboard.writeText(value), url);
    await this.page.keyboard.press("ControlOrMeta+V");
  }

  /** Types `url` into the item's URL field and leaves it. */
  async typeItemUrl(url: string) {
    await this.openConditions();
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

  /** A campaign's switch, by the start of its name. */
  campaign(name: string) {
    return this.root
      .getByRole("region", { name: "キャンペーン" })
      .getByRole("switch", { name: new RegExp(`^${name}`) });
  }

  /** Taps a card (a campaign) on its label: its input is visually hidden. */
  async tap(card: Locator) {
    await card.locator("xpath=ancestor::label[1]").click();
  }
}

/** A month's SPU, in a side panel over the plan's page. */
export class SpuPanel {
  readonly root: Locator;

  constructor(
    readonly page: Page,
    month: string,
  ) {
    this.root = page.getByRole("dialog", { name: `${month}の SPU` });
  }

  /** An SPU tile, such as `楽天モバイル +4倍`. */
  spuTile(name: string) {
    return this.root.getByRole("checkbox", { name });
  }

  /** Taps a tile on its label: its input is visually hidden. */
  async tap(tile: Locator) {
    await tile.locator("xpath=ancestor::label[1]").click();
  }

  async close() {
    await this.root.getByRole("button", { name: "計算に戻る" }).click();
    await expect(this.root).toBeHidden();
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
    await this.addForm.add();
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

  /** The ポイント倍率 of the SPU of the plan's one month (`10月`), in 「SPU の設定」. */
  spuRate(month: string) {
    return this.page
      .getByRole("region", { name: "SPU の設定" })
      .getByText(new RegExp(`^SPU（${month}）`))
      .locator("xpath=following-sibling::*[1]");
  }

  /** Opens the SPU of `month` (`10月`) from 「SPU の設定」. */
  async openSpu(month: string) {
    await this.page.getByRole("button", { name: `${month}の SPU を変更` }).click();
    const spu = new SpuPanel(this.page, month);
    await expect(spu.root).toBeVisible();
    return spu;
  }

  async openSettings() {
    await this.page.getByRole("button", { name: "プランの設定", exact: true }).click();
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
