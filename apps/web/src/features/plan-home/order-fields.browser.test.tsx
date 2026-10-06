import type { Shop } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { AmountSchema, CommitField, NEW_SHOP, type ShopChoice, shopToSave } from "./order-fields";

const shop = (fields: Partial<Shop> & Pick<Shop, "id" | "name">): Shop => ({
  channel: "rakuten-ichiba",
  tags: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
  ...fields,
});

const registry = [
  shop({ id: "a0000000-0000-4000-8000-000000000001", name: "aaa-shop", shopCode: "aaa-shop" }),
  shop({ id: "a0000000-0000-4000-8000-000000000002", name: "近所の店" }),
];

const choice = (fields: Partial<ShopChoice>): ShopChoice => ({
  shop: NEW_SHOP,
  newShopName: "",
  channel: "rakuten-ichiba",
  shopCode: "",
  is39: false,
  ...fields,
});

test("a shop from a URL is reused only for the same channel and shop code", () => {
  // The name matches a registry shop, but the shop code does not: a new shop.
  const other = shopToSave(choice({ newShopName: "aaa-shop", shopCode: "bbb-shop" }), registry);
  expect(registry.map((s) => s.id)).not.toContain(other.shopId);
  expect(other.shop).toMatchObject({ name: "aaa-shop", shopCode: "bbb-shop" });

  // A registry shop without a shop code is not reused by its name for a URL either.
  const named = shopToSave(choice({ newShopName: "近所の店", shopCode: "near-shop" }), registry);
  expect(registry.map((s) => s.id)).not.toContain(named.shopId);

  const same = shopToSave(choice({ newShopName: "別の名前", shopCode: "aaa-shop" }), registry);
  expect(same.shopId).toBe(registry[0]?.id);
});

test("a typed name reuses the shop of that name on the same channel", () => {
  const typed = shopToSave(choice({ newShopName: "近所の店" }), registry);
  expect(typed.shopId).toBe(registry[1]?.id);

  const elsewhere = shopToSave(
    choice({ newShopName: "近所の店", channel: "rakuten-books" }),
    registry,
  );
  expect(registry.map((s) => s.id)).not.toContain(elsewhere.shopId);
});

test("a commit that failed can be made again with the same text", async () => {
  const onCommit = vi
    .fn<(amount: number) => Promise<unknown>>()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <CommitField label="金額（税込）" initial="1,000" schema={AmountSchema} onCommit={onCommit} />
    </UIProvider>,
  );

  const field = screen.getByRole("textbox", { name: "金額（税込）" });
  await field.fill("2,000");
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onCommit.mock.calls.length).toBe(1);
  // Let the rejection settle before committing the same text again.
  await new Promise((resolve) => setTimeout(resolve, 0));

  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onCommit.mock.calls.length).toBe(2);
  expect(onCommit).toHaveBeenLastCalledWith(2000);

  // Once saved, the same text is not saved again.
  await userEvent.keyboard("{Enter}");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onCommit).toHaveBeenCalledTimes(2);
});
