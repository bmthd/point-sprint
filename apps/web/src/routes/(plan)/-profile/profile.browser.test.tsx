import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { beforeEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { createIndexedDbRepository } from "../../../storage/indexed-db-repository";
import { createMemoryRepository } from "../../../storage/memory-repository";
import type { Repository } from "../../../storage/repository";
import { Providers, shops } from "../-test-fixtures";
import { Profile } from "./profile";

beforeEach(async () => {
  await page.viewport(390, 844);
});

async function renderProfile(
  repository: Repository = createMemoryRepository({ shops }),
  from: Repository = repository,
  initialEntries = ["/profile"],
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <p>一覧</p>,
  });
  const plan = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <p>プラン</p>,
  });
  const profile = createRoute({
    getParentRoute: () => root,
    path: "/profile",
    component: () => <Profile />,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, plan, profile]),
    history: createMemoryHistory({ initialEntries }),
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

test("戻る goes back to the page the profile was opened from", async () => {
  const screen = await renderProfile(undefined, undefined, ["/plan", "/profile"]);
  await screen.getByRole("link", { name: "戻る" }).click();
  await expect.element(screen.getByText("プラン")).toBeVisible();
});

test("戻る goes to the top when the profile was opened directly", async () => {
  const screen = await renderProfile();
  await screen.getByRole("link", { name: "戻る" }).click();
  await expect.element(screen.getByText("一覧")).toBeVisible();
});

test("the profile has no SPU card: the SPU is set in each plan's settings", async () => {
  const screen = await renderProfile(createMemoryRepository({ shops }));
  await expect.element(screen.getByRole("heading", { name: "ショップ台帳" })).toBeVisible();
  expect(screen.getByRole("group", { name: "SPU のサービス" }).query()).toBeNull();
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

  // An empty name is not saved: it says what to type, and Escape puts the old one back.
  const other = screen.getByRole("textbox", { name: "ショップ3の名前" });
  await other.fill("");
  await other.element().blur();
  await expect.element(other).toHaveAccessibleDescription("ショップの名前を入れてください");
  expect((await repository.shops.list()).map((s) => s.name)).toContain("ショップ3");
  await other.click();
  await userEvent.keyboard("{Escape}");
  await expect.element(other).toHaveValue("ショップ3");
  await expect.element(other).not.toHaveAttribute("aria-invalid", "true");
});

test("shows a notice when data was quarantined", async () => {
  const base = createMemoryRepository({ shops });
  const screen = await renderProfile(base, {
    ...base,
    quarantined: async () => 2,
    wasReset: () => true,
  });
  await expect.element(screen.getByText("読み込めなかったデータが2件あります。")).toBeVisible();
  await expect
    .element(screen.getByText("保存されたデータを開けなかったため、空の状態からやり直しています。"))
    .toBeVisible();
});

test("shows the quarantined rows as JSON and removes them", async () => {
  const issues = [{ message: "Invalid type", path: ["name"] }];
  const repository = createMemoryRepository({
    shops,
    quarantine: [
      { store: "plans", value: { id: "broken", name: 1 }, issues },
      { store: "shops", value: { id: "shop", name: 2 }, issues },
    ],
  });
  const screen = await renderProfile(repository);
  await screen.getByRole("button", { name: "確認する" }).click();

  const dialog = screen.getByRole("dialog");
  const plan = dialog.getByRole("region", { name: "プランのデータ" });
  await expect.element(plan).toBeVisible();
  await expect.element(plan.getByText(/"name": 1/)).toBeVisible();
  await expect.element(plan.getByText("name: Invalid type")).toBeVisible();

  await plan.getByRole("button", { name: "削除" }).click();
  await expect.element(screen.getByText("読み込めなかったデータが1件あります。")).toBeVisible();
  expect(await repository.quarantine.list()).toHaveLength(1);

  await dialog.getByRole("button", { name: "すべて削除" }).click();
  await expect.poll(() => repository.quarantined()).toBe(0);
  await expect.element(screen.getByText(/読み込めなかったデータが/)).not.toBeInTheDocument();
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
  await putRawProfile(name, { updatedAt: "not a timestamp" });

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
  await expect.element(screen.getByText("読み込めなかったデータが1件あります。")).toBeVisible();
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
  await expect.element(screen.getByText("読み込めなかったデータが3件あります。")).toBeVisible();
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

test("accounts stay hidden until they are turned on in the advanced settings", async () => {
  const repository = createMemoryRepository({ shops });
  const screen = await renderProfile(repository);
  const toggle = screen.getByRole("switch", { name: "複数の楽天アカウントを使い分ける" });
  await expect.element(toggle).not.toBeChecked();
  expect(screen.getByRole("list", { name: "楽天アカウント" }).query()).toBeNull();
  expect(screen.getByRole("button", { name: "＋ アカウントを追加" }).query()).toBeNull();

  await screen.getByText("複数の楽天アカウントを使い分ける").click();
  await expect.element(toggle).toBeChecked();
  const list = screen.getByRole("list", { name: "楽天アカウント" });
  await expect.element(list.getByRole("textbox", { name: "メインの名前" })).toHaveValue("メイン");
  // The default account cannot be deleted.
  expect(screen.getByRole("button", { name: "メインを削除" }).query()).toBeNull();
  await expect.poll(async () => (await storedProfile(repository)).multiAccount).toBe(true);

  await screen.getByRole("button", { name: "＋ アカウントを追加" }).click();
  const added = list.getByRole("textbox", { name: "アカウント2の名前" });
  await expect.element(added).toBeVisible();
  await added.fill("家族");
  await userEvent.keyboard("{Enter}");
  await expect
    .poll(async () => (await storedProfile(repository)).accounts?.map((a) => a.name))
    .toEqual(["メイン", "家族"]);

  await screen.getByRole("button", { name: "家族を削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect
    .poll(async () => (await storedProfile(repository)).accounts?.map((a) => a.name))
    .toEqual(["メイン"]);
  // A click while the dialog is still closing lands on its overlay, not on the switch.
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

  // Turning it off hides the accounts again.
  await screen.getByText("複数の楽天アカウントを使い分ける").click();
  await expect.element(toggle).not.toBeChecked();
  expect(screen.getByRole("list", { name: "楽天アカウント" }).query()).toBeNull();
});

test("データを初期化 removes every stored row and goes to the top", async () => {
  const repository = createMemoryRepository({
    shops,
    profile: { updatedAt: "2026-10-05T00:00:00.000Z" },
  });
  const screen = await renderProfile(repository);

  await screen.getByRole("button", { name: "データを初期化" }).click();
  await screen.getByRole("button", { name: "初期化する" }).click();

  await expect.element(screen.getByText("一覧")).toBeVisible();
  expect(await repository.shops.list()).toEqual([]);
  expect(await repository.profile.get()).toBeUndefined();
});

test("キャンセル in the reset dialog keeps the data", async () => {
  const repository = createMemoryRepository({ shops });
  const screen = await renderProfile(repository);

  await screen.getByRole("button", { name: "データを初期化" }).click();
  await screen.getByRole("button", { name: "キャンセル" }).click();

  await expect.element(screen.getByRole("heading", { name: "プロフィール" })).toBeVisible();
  expect(await repository.shops.list()).toHaveLength(shops.length);
});
