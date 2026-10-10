import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import type { ItemLookup, ItemLookupFailure, ItemLookupResult } from "../../rakuten/item-lookup";
import type { RakutenItem } from "../../rakuten/item-search";
import { createMemoryRepository } from "../../storage/memory-repository";
import {
  PLAN,
  marathonPlan,
  order,
  orderId,
  renderPlanHome,
  shopId,
  shops,
} from "./-test-fixtures";

// The Rakuten API is never called here: every test gives the editor a lookup of its own.

const ITEM_URL = "https://item.rakuten.co.jp/coffee-beans/blend-500g/";

const item = (fields: Partial<RakutenItem> = {}): RakutenItem => ({
  itemCode: "coffee-beans:10000123",
  name: "ブレンドコーヒー豆 500g",
  taxIncludedPrice: 2160,
  shopCode: "coffee-beans",
  shopName: "コーヒー豆の店",
  pointRate: 5,
  pageUrl: ITEM_URL,
  itemUrl: "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2F",
  affiliateUrl: "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2F",
  imageUrl: undefined,
  ...fields,
});

const answering = (result: ItemLookupResult) => vi.fn<ItemLookup>(async () => result);
const failing = (error: ItemLookupFailure) => answering({ ok: false, error });

/** Pastes `text` over the field's text, as a paste from the clipboard does. */
async function paste(field: Locator, text: string) {
  const input = field.element() as HTMLInputElement;
  input.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: text }),
  );
}

/** The item pages a lookup was asked for, with how long each could wait. */
const askedFor = (lookup: ReturnType<typeof vi.fn<ItemLookup>>) =>
  lookup.mock.calls.map(([asked, { maxWaitMs }]) => [asked.itemManageNumber, maxWaitMs]);

let currentRepository: ReturnType<typeof createMemoryRepository> | undefined;
const repository = () => {
  if (!currentRepository) throw new Error("no repository");
  return currentRepository;
};
const stored = async () => (await repository().plans.get(PLAN))?.orders ?? [];

async function renderWith(lookup: ItemLookup, path = `/plan?id=${PLAN}`, plan = marathonPlan()) {
  const withCode = shops.map((shop, index) =>
    index === 4 ? { ...shop, shopCode: "shop-four", tags: ["39shop" as const] } : shop,
  );
  currentRepository = createMemoryRepository({ shops: withCode, plans: [plan] });
  return renderPlanHome(currentRepository, path, lookup);
}

type Screen = Awaited<ReturnType<typeof renderWith>>;

async function openSheet(screen: Screen) {
  await screen.getByRole("button", { name: "注文を追加" }).click();
  const sheet = screen.getByRole("dialog", { name: "注文を追加" });
  await expect.element(sheet).toBeVisible();
  return sheet;
}

const FAILED = /^自動入力できませんでした/;
const LOADING = /^商品情報を取得しています/;
const BUSY = /^混み合っているため、自動入力を止めました/;
const TOO_BUSY = /^混み合っていて待ち時間が長いため、自動入力を止めました/;

describe("the phone sheet", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  test("a pasted Ichiba URL fills in the item and a new shop, which can be edited", async () => {
    const lookup = answering({ ok: true, item: item() });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);

    await paste(sheet.getByLabelText(/^商品のURL/), ITEM_URL);
    await expect
      .element(sheet.getByLabelText("商品名メモ（任意）"))
      .toHaveValue("ブレンドコーヒー豆 500g");
    expect(askedFor(lookup)).toEqual([["blend-500g", 5000]]);
    expect(lookup.mock.calls[0]?.[0]).toEqual({
      shopCode: "coffee-beans",
      itemManageNumber: "blend-500g",
    });
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("2160");
    await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue("new");
    await expect
      .element(sheet.getByLabelText("新しいショップの名前"))
      .toHaveValue("コーヒー豆の店");
    await expect.element(sheet.getByText(LOADING)).not.toBeInTheDocument();
    expect(sheet.getByText(FAILED).query()).toBeNull();

    await sheet.getByText(/^詳細設定/).click();
    await expect.element(sheet.getByLabelText("ショップ独自倍率")).toHaveValue("5");
    await sheet.getByLabelText("金額（税込）").fill("2000");
    await sheet.getByLabelText("注文日").fill("2026/10/05");
    await sheet.getByRole("button", { name: "追加する", exact: true }).click();

    await expect.poll(async () => (await stored()).length).toBe(5);
    const saved = (await stored()).at(-1);
    expect(saved?.lineItems).toEqual([
      expect.objectContaining({
        name: "ブレンドコーヒー豆 500g",
        unitPrice: 2000,
        shopPointRate: 5,
        url: ITEM_URL,
      }),
    ]);
    const shop = (await repository().shops.list()).find((s) => s.id === saved?.shopId);
    expect(shop).toMatchObject({
      channel: "rakuten-ichiba",
      shopCode: "coffee-beans",
      name: "コーヒー豆の店",
    });
  });

  test("a typed URL is looked up once the field is left, and the same item only once", async () => {
    const lookup = answering({ ok: true, item: item() });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await url.fill(ITEM_URL);
    // The shop is chosen while typing; the item waits for the field to be left.
    await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("coffee-beans");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(lookup).not.toHaveBeenCalled();

    await sheet.getByLabelText("金額（税込）").click();
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("2160");
    expect(askedFor(lookup)).toEqual([["blend-500g", 5000]]);

    // Leaving it again, or pasting the same item, calls nothing.
    await url.click();
    await sheet.getByLabelText("金額（税込）").click();
    await paste(url, `${ITEM_URL}?s-id=top`);
    await sheet.getByLabelText("金額（税込）").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  test("Enter looks up a typed URL without adding the order", async () => {
    const lookup = answering({ ok: true, item: item() });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await url.fill(ITEM_URL);
    await userEvent.keyboard("{Enter}");
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("2160");
    expect(lookup).toHaveBeenCalledTimes(1);
    await expect.element(sheet).toBeVisible();
    expect(await stored()).toHaveLength(4);
  });

  test("an item of a registered shop selects that shop, and a rate of 1 is left empty", async () => {
    const lookup = answering({
      ok: true,
      item: item({ shopCode: "shop-four", shopName: "別の名前", pointRate: 1 }),
    });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);

    await paste(sheet.getByLabelText(/^商品のURL/), "https://item.rakuten.co.jp/shop-four/x/");
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("2160");
    await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue(shopId(4));
    await sheet.getByText(/^詳細設定/).click();
    await expect.element(sheet.getByLabelText("ショップ独自倍率")).toHaveValue("");
  });

  test.each<[string, ItemLookupFailure]>([
    ["a network error", { reason: "network" }],
    ["no such item", { reason: "not-found" }],
    ["429", { reason: "rate-limited" }],
    ["no Rakuten settings on the server", { reason: "unavailable" }],
  ])("%s keeps the shop of the URL and says it could not fill in", async (_case, error) => {
    const screen = await renderWith(failing(error));
    const sheet = await openSheet(screen);

    await paste(sheet.getByLabelText(/^商品のURL/), ITEM_URL);
    await expect.element(sheet.getByText(FAILED)).toBeVisible();
    await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue("new");
    await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("coffee-beans");
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("");
    await expect.element(sheet.getByLabelText("商品名メモ（任意）")).toHaveValue("");

    // The order can still be typed and added.
    await sheet.getByLabelText("金額（税込）").fill("1500");
    await sheet.getByLabelText("注文日").fill("2026/10/05");
    await sheet.getByRole("button", { name: "追加する", exact: true }).click();
    await expect.poll(async () => (await stored()).length).toBe(5);
    expect((await stored()).at(-1)?.lineItems[0]).toMatchObject({ unitPrice: 1500, url: ITEM_URL });
  });

  test("when busy, waits for the item in two taps, counting down", async () => {
    let answer: (result: ItemLookupResult) => void = () => {};
    const lookup = vi
      .fn<ItemLookup>()
      .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 7200 } })
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);

    await paste(sheet.getByLabelText(/^商品のURL/), ITEM_URL);
    await expect.element(sheet.getByText(BUSY)).toBeVisible();
    await sheet.getByRole("button", { name: "待って取得する" }).click();
    await expect
      .element(sheet.getByText("取得まで約 8 秒かかります。待つ間も手で入れられます。"))
      .toBeVisible();
    await sheet.getByRole("button", { name: "約 8 秒待つ" }).click();

    await expect.element(sheet.getByText(/^商品情報を取得しています… あと [78] 秒$/)).toBeVisible();
    expect(askedFor(lookup)).toEqual([
      ["blend-500g", 5000],
      ["blend-500g", 30000],
    ]);
    await expect.element(sheet.getByText(/^商品情報を取得しています… あと [67] 秒$/)).toBeVisible();

    answer({ ok: true, item: item() });
    await expect.element(sheet.getByLabelText("金額（税込）")).toHaveValue("2160");
    await expect.element(sheet.getByText(LOADING)).not.toBeInTheDocument();
  });

  test("「やめる」 stops waiting and lets the call go", async () => {
    const lookup = vi
      .fn<ItemLookup>()
      .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 3000 } })
      .mockImplementation(() => new Promise(() => {}));
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);

    await paste(sheet.getByLabelText(/^商品のURL/), ITEM_URL);
    await sheet.getByRole("button", { name: "待って取得する" }).click();
    // Not waiting yet: back without a call.
    await sheet.getByRole("button", { name: "やめる" }).click();
    await expect.element(sheet.getByText(BUSY)).toBeVisible();
    expect(lookup).toHaveBeenCalledTimes(1);

    await sheet.getByRole("button", { name: "待って取得する" }).click();
    await sheet.getByRole("button", { name: "約 3 秒待つ" }).click();
    await expect.element(sheet.getByText(/^商品情報を取得しています… あと/)).toBeVisible();
    const signal = lookup.mock.calls[1]?.[1].signal;
    expect(signal?.aborted).toBe(false);
    await sheet.getByRole("button", { name: "やめる" }).click();
    await expect.element(sheet.getByText(BUSY)).toBeVisible();
    expect(signal?.aborted).toBe(true);
  });

  test("a wait over 30 seconds is not offered, and says why", async () => {
    const lookup = vi
      .fn<ItemLookup>()
      .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 30_100 } })
      .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 4000 } })
      .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 31_000 } });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await paste(url, ITEM_URL);
    await expect.element(sheet.getByText(TOO_BUSY)).toBeVisible();

    // The line grew while the user decided to wait.
    await paste(url, "https://item.rakuten.co.jp/shop-four/x/");
    await sheet.getByRole("button", { name: "待って取得する" }).click();
    await sheet.getByRole("button", { name: "約 4 秒待つ" }).click();
    await expect.element(sheet.getByText(TOO_BUSY)).toBeVisible();
  });

  test("Books, Rakuma and shop pages pick the shop without a lookup", async () => {
    const lookup = answering({ ok: true, item: item() });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await paste(url, "https://books.rakuten.co.jp/rb/12345/");
    await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("楽天ブックス");
    await paste(url, "https://item.fril.jp/abc");
    await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("ラクマ");
    await paste(url, "https://www.rakuten.co.jp/coffee-beans/");
    await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("coffee-beans");
    await userEvent.keyboard("{Enter}");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(lookup).not.toHaveBeenCalled();
    await expect.element(sheet.getByText(LOADING)).not.toBeInTheDocument();
    expect(sheet.getByText(FAILED).query()).toBeNull();
  });

  test("an answer for a URL that has since been replaced is dropped", async () => {
    let answer: (result: ItemLookupResult) => void = () => {};
    const lookup = vi
      .fn<ItemLookup>()
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
      .mockResolvedValue({ ok: false, error: { reason: "not-found" } });
    const screen = await renderWith(lookup);
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await paste(url, ITEM_URL);
    await expect.element(sheet.getByText(LOADING)).toBeVisible();
    await expect.poll(() => lookup.mock.calls.length).toBe(1);
    await paste(url, "https://item.rakuten.co.jp/shop-four/other/");
    await expect.element(sheet.getByText(FAILED)).toBeVisible();
    expect(lookup.mock.calls[0]?.[1].signal?.aborted).toBe(true);

    answer({ ok: true, item: item() });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect.element(sheet.getByLabelText("商品名メモ（任意）")).toHaveValue("");
    await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue(shopId(4));
  });

  test("typing another URL clears what the status said about the last one", async () => {
    const screen = await renderWith(failing({ reason: "not-found" }));
    const sheet = await openSheet(screen);
    const url = sheet.getByLabelText(/^商品のURL/);

    await paste(url, ITEM_URL);
    await expect.element(sheet.getByText(FAILED)).toBeVisible();
    await url.fill("https://item.rakuten.co.jp/coffee-beans/blend-1kg/");
    await expect.element(sheet.getByText(FAILED)).not.toBeInTheDocument();
  });
});

describe("the desktop", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  test("the add form fills in the item, and says when it cannot", async () => {
    const lookup = vi
      .fn<ItemLookup>()
      .mockResolvedValueOnce({ ok: true, item: item() })
      .mockResolvedValue({ ok: false, error: { reason: "rate-limited" } });
    const screen = await renderWith(lookup, `/plan?id=${PLAN}`, marathonPlan([]));
    const url = screen.getByRole("textbox", { name: /^商品のURL/ });

    await paste(url, ITEM_URL);
    await expect
      .element(screen.getByRole("textbox", { name: "商品名メモ" }))
      .toHaveValue("ブレンドコーヒー豆 500g");
    await expect.element(screen.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("2160");
    await expect
      .element(screen.getByRole("textbox", { name: "新しいショップの名前" }))
      .toHaveValue("コーヒー豆の店");
    await expect
      .element(screen.getByRole("textbox", { name: "ショップ独自倍率" }))
      .toHaveValue("5");
    await screen.getByRole("button", { name: "追加する" }).click();

    await expect.poll(async () => (await stored()).length).toBe(1);
    expect((await stored())[0]?.lineItems[0]).toMatchObject({
      name: "ブレンドコーヒー豆 500g",
      unitPrice: 2160,
      shopPointRate: 5,
      url: ITEM_URL,
    });

    // The emptied form looks up the next URL, also the same item again, and keeps its shop when
    // the lookup fails.
    await url.fill("https://item.rakuten.co.jp/shop-four/x/");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText(FAILED)).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "ショップ" })).toHaveValue(shopId(4));
    await expect.element(screen.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("");
    expect(await stored()).toHaveLength(1);
  });

  test("the edit dialog fills in a new URL's item over the order's fields", async () => {
    const lookup = answering({ ok: true, item: item({ taxIncludedPrice: undefined }) });
    const screen = await renderWith(lookup, `/plan?id=${PLAN}&edit=${orderId(1)}`);
    const dialog = screen.getByRole("dialog", { name: "注文を編集" });
    await expect.element(dialog).toBeVisible();
    expect(lookup).not.toHaveBeenCalled();

    await paste(dialog.getByLabelText(/^商品のURL/), ITEM_URL);
    await expect
      .element(dialog.getByLabelText("商品名メモ（任意）"))
      .toHaveValue("ブレンドコーヒー豆 500g");
    // A price listed without tax is not put in the amount.
    await expect.element(dialog.getByLabelText("金額（税込）")).toHaveValue("11000");
    await dialog.getByRole("button", { name: "保存する" }).click();
    await expect.element(dialog).not.toBeInTheDocument();

    const saved = (await stored()).find((other) => other.id === orderId(1));
    expect(saved?.lineItems[0]).toMatchObject({
      name: "ブレンドコーヒー豆 500g",
      unitPrice: order(1).lineItems[0]?.unitPrice,
      shopPointRate: 5,
      url: ITEM_URL,
    });
  });
});
