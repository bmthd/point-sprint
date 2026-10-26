import { siteUrl } from "../src/site-url";
import { expect, test } from "./fixtures";
import { PlanSettingsPage, SitePage, TopPage } from "./pages";

// The prerendered HTML holds each page's title; a plan's pages put the plan's name in once loaded.

test("each page has its own title", async ({ page }) => {
  const pages = [
    { path: "/", title: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール" },
    { path: "/profile", title: "共通設定 | ポイントスプリント" },
    { path: "/spu", title: "月ごとの SPU | ポイントスプリント" },
    { path: "/help", title: "使い方・注意事項 | ポイントスプリント" },
    { path: "/terms", title: "利用規約 | ポイントスプリント" },
    { path: "/privacy", title: "プライバシーポリシー | ポイントスプリント" },
  ];
  for (const { path, title } of pages) {
    await SitePage.open(page, path);
    await expect(page).toHaveTitle(title);
  }
});

test("a plan's pages show the plan's name in the title", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const plan = await (await TopPage.open(page)).createPlan();
  const name = (await plan.name.innerText()).trim();
  await expect(page).toHaveTitle(`${name} | ポイントスプリント`);

  await plan.reload();
  await expect(page).toHaveTitle(`${name} | ポイントスプリント`);

  const settings = await PlanSettingsPage.open(page, plan.id);
  await expect(page).toHaveTitle(`${name}の設定 | ポイントスプリント`);

  await settings.header.goToProfile();
  await expect(page).toHaveTitle("共通設定 | ポイントスプリント");
});

test("the files the head links to are served", async ({ request }) => {
  for (const path of [
    "/favicon.ico",
    "/icon.svg",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-512.png",
    "/opengraph-image.png",
    "/manifest.json",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
});

test("robots.txt points to the sitemap on the site's domain", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);
});
