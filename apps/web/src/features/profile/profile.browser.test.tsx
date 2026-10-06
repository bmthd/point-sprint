import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { standardSpu } from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { type Locator, page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { createIndexedDbRepository } from "../../storage/indexed-db-repository";
import { createMemoryRepository } from "../../storage/memory-repository";
import type { Repository } from "../../storage/repository";
import { Providers, shops } from "../plan-home/test-fixtures";
import { Profile } from "./profile";

beforeEach(async () => {
  await page.viewport(390, 844);
});

/**
 * Taps a checkbox card (an SPU tile, a campaign). Its checkbox is visually hidden under the card, so
 * the card (its label) is tapped.
 */
const tapCard = (tile: Locator) => {
  const label = tile.element().closest("label");
  if (!label) throw new Error("no card label");
  return page.elementLocator(label).click();
};

async function renderProfile(
  repository: Repository = createMemoryRepository({ shops }),
  from: Repository = repository,
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <p>一覧</p>,
  });
  const profile = createRoute({
    getParentRoute: () => root,
    path: "/profile",
    component: () => <Profile />,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, profile]),
    history: createMemoryHistory({ initialEntries: ["/profile"] }),
  });
  const screen = await render(
    <Providers repository={from}>
      <RouterProvider router={router} />
    </Providers>,
  );
  await expect.element(screen.getByRole("heading", { name: "プロフィール" })).toBeVisible();
  return screen;
}

const storedProfile = async (repository: Repository) => {
  const profile = await repository.profile.get();
  if (!profile) throw new Error("no profile");
  return profile;
};

test("SPU defaults are saved to the profile", async () => {
  const repository = createMemoryRepository({ shops });
  const screen = await renderProfile(repository);
  await expect
    .element(
      screen.getByText(
        "ここでの変更は、これから作るプランの初期値になります。作成済みのプランは変わりません。",
      ),
    )
    .toBeVisible();
  expect(screen.getByRole("checkbox", { name: /^通常ポイント/ }).query()).toBeNull();

  const mobile = screen.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  await expect.element(mobile).not.toBeChecked();
  await tapCard(mobile);
  await expect.element(mobile).toBeChecked();
  await expect
    .poll(
      async () =>
        (await storedProfile(repository)).spuBenefits.find((b) => b.label === "楽天モバイル")
          ?.enabled,
    )
    .toBe(true);

  // The exclusive group rule applies as in a plan.
  const card = screen.getByRole("checkbox", { name: "楽天カード特典分（SPU） +1倍" });
  const premium = screen.getByRole("checkbox", { name: "楽天プレミアムカード（特典分） +1倍" });
  await tapCard(card);
  await expect.element(card).toBeChecked();
  await tapCard(premium);
  await expect.element(card).not.toBeChecked();
  await expect
    .poll(async () => (await storedProfile(repository)).spuBenefits.map((b) => b.enabled))
    .toEqual(
      standardSpu.map((b) =>
        ["楽天モバイル", "楽天プレミアムカード（特典分）"].includes(b.label) ? true : b.enabled,
      ),
    );
});

test("marks a shop as 39shop", async () => {
  const repository = createMemoryRepository({ shops });
  const screen = await renderProfile(repository);
  const list = screen.getByRole("list", { name: "ショップ台帳" });
  await expect.element(list.getByText(/購入先 楽天市場/).first()).toBeVisible();

  const toggle = screen.getByRole("switch", { name: "ショップ1 39ショップ" });
  // The switch's input is visually hidden: a user clicks its label.
  const label = list
    .getByRole("listitem")
    .filter({ has: page.getByRole("switch", { name: "ショップ1 39ショップ" }) })
    .getByText("39ショップ", { exact: true });
  await expect.element(toggle).not.toBeChecked();
  await label.click();
  await expect.element(toggle).toBeChecked();
  await expect
    .poll(async () => (await repository.shops.list()).find((s) => s.name === "ショップ1")?.tags)
    .toEqual(["39shop"]);

  await label.click();
  await expect
    .poll(async () => (await repository.shops.list()).find((s) => s.name === "ショップ1")?.tags)
    .toEqual([]);
});

test("renames a shop inline", async () => {
  const repository = createMemoryRepository({ shops });
  const screen = await renderProfile(repository);
  const name = screen.getByRole("textbox", { name: "ショップ2の名前" });
  await name.fill("新しい名前");
  await name.element().blur();
  await expect
    .poll(async () => (await repository.shops.list()).map((s) => s.name))
    .toContain("新しい名前");

  // An empty name is not saved; the old one comes back.
  const other = screen.getByRole("textbox", { name: "ショップ3の名前" });
  await other.fill("");
  await other.element().blur();
  await expect.element(other).toHaveValue("ショップ3");
  expect((await repository.shops.list()).map((s) => s.name)).toContain("ショップ3");
});

test("shows a notice when data was quarantined", async () => {
  const base = createMemoryRepository({ shops });
  const screen = await renderProfile(base, {
    ...base,
    quarantined: async () => 2,
    wasReset: () => true,
  });
  await expect
    .element(
      screen.getByText("読み込めなかったデータが2件あります。表示と計算には含めていません。"),
    )
    .toBeVisible();
  await expect
    .element(screen.getByText("保存されたデータを開けなかったため、空の状態からやり直しています。"))
    .toBeVisible();
});

test("shows no notice when the data is healthy", async () => {
  const screen = await renderProfile();
  await expect.element(screen.getByRole("list", { name: "ショップ台帳" })).toBeVisible();
  expect(screen.getByText(/読み込めなかったデータ/).query()).toBeNull();
});

test("shows a notice when the stored profile is invalid", async () => {
  const name = `profile-health-${Date.now()}`;
  const stored = createIndexedDbRepository({ name });
  await stored.quarantined(); // creates the stores
  await putRawProfile(name, { spuBenefits: "broken", updatedAt: "not a timestamp" });

  // The profile is read well after the plans and shops, so the notice has to be checked again
  // once the profile has been read.
  const screen = await renderProfile(createMemoryRepository({ shops }), {
    ...stored,
    profile: {
      ...stored.profile,
      get: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return stored.profile.get();
      },
    },
  });
  await expect
    .element(
      screen.getByText("読み込めなかったデータが1件あります。表示と計算には含めていません。"),
    )
    .toBeVisible();
});

test("offers a retry when the stored data cannot be checked", async () => {
  const base = createMemoryRepository({ shops });
  let failures = 1;
  const screen = await renderProfile(base, {
    ...base,
    quarantined: async () => {
      if (failures-- > 0) throw new Error("unavailable");
      return 3;
    },
  });
  await expect
    .element(screen.getByRole("alert").getByText("保存データの状態を確認できませんでした。"))
    .toBeVisible();
  await screen.getByRole("button", { name: "再試行" }).click();
  await expect
    .element(
      screen.getByText("読み込めなかったデータが3件あります。表示と計算には含めていません。"),
    )
    .toBeVisible();
  expect(screen.getByText("保存データの状態を確認できませんでした。").query()).toBeNull();
});

// The repository refuses invalid rows, so write one through a plain IndexedDB connection.
async function putRawProfile(name: string, row: unknown): Promise<void> {
  const raw = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = raw.transaction("profile", "readwrite");
    transaction.objectStore("profile").put(row, "profile");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  raw.close();
}
