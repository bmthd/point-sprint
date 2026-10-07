import { expect, test } from "@playwright/test";

// The prerendered HTML holds each page's title; a plan's pages put the plan's name in once loaded.

test("each page has its own title", async ({ page }) => {
  const pages = [
    { path: "/", title: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール" },
    { path: "/profile", title: "プロフィール | ポイントスプリント" },
    { path: "/help", title: "使い方・注意事項 | ポイントスプリント" },
    { path: "/terms", title: "利用規約 | ポイントスプリント" },
  ];
  for (const { path, title } of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test("a plan's pages show the plan's name in the title", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  await expect(page).toHaveURL(/\/plan\?id=/);
  const name = (
    await page.getByRole("button", { name: /、プランを切り替える$/ }).innerText()
  ).trim();
  await expect(page).toHaveTitle(`${name} | ポイントスプリント`);

  await page.reload();
  await expect(page).toHaveTitle(`${name} | ポイントスプリント`);

  await page.goto(page.url().replace("/plan?", "/plan/settings?"));
  await expect(page).toHaveTitle(`${name}の設定 | ポイントスプリント`);

  await page
    .getByRole("banner")
    .getByRole("link", { name: "プロフィール（SPU・ショップ台帳）" })
    .click();
  await expect(page).toHaveTitle("プロフィール | ポイントスプリント");
});

test("the files the head links to are served", async ({ request }) => {
  for (const path of [
    "/favicon.ico",
    "/icon-32.png",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/opengraph-image.png",
    "/manifest.json",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
});
