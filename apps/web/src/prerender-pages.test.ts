import { expect, test } from "vitest";
import { guideSlugs } from "./guides/files";
import { getRouter } from "./router";
import {
  guideItemListCount,
  missingHeadTags,
  missingPrerenderedPages,
  pagesRenderedOnRequest,
  prerenderedPages,
  robotsTxt,
  sitemapEntry,
  sitemapXml,
} from "./prerender-pages";
import { siteUrl } from "./site-url";

test("every route is prerendered or rendered on request, and a guide's route for each guide", () => {
  const slugs = guideSlugs();
  expect(slugs).toContain("1000yen-items");
  const routePaths = Object.keys(getRouter().routesByPath)
    .map((path) => (path.length > 1 ? path.replace(/\/$/, "") : path))
    .flatMap((path) =>
      path === "/guides/$slug" ? slugs.map((slug) => `/guides/${slug}`) : [path],
    );
  expect(
    [...prerenderedPages.map((page) => page.path), ...pagesRenderedOnRequest].toSorted(),
  ).toEqual([...new Set(routePaths)].toSorted());
});

test("lists the pages whose HTML file is missing", () => {
  const built = new Set(
    prerenderedPages.map((page) => page.file).filter((file) => file !== "plan/settings/index.html"),
  );
  expect(missingPrerenderedPages((file) => built.has(file))).toEqual(["plan/settings/index.html"]);
});

const fullHead = `<head>
<title>プロフィール | ポイントスプリント</title>
<meta name="description" content="説明"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="ポイントスプリント"/>
<meta property="og:title" content="プロフィール | ポイントスプリント"/>
<meta property="og:description" content="説明"/>
<meta property="og:url" content="${siteUrl}/profile"/>
<meta property="og:image" content="${siteUrl}/opengraph-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="manifest" href="/manifest.json"/>
<link rel="canonical" href="${siteUrl}/profile"/>
</head>`;

test("a page with every head tag lacks none", () => {
  expect(missingHeadTags(fullHead)).toEqual([]);
});

test("names the head tags a page lacks", () => {
  const html = fullHead
    .replace(/<title>.*<\/title>/, "")
    .replace(/<meta property="og:image"[^>]*>/, "")
    .replace(/<meta name="description" content="説明"/, '<meta name="description" content=""')
    .replace(/<link rel="canonical"[^>]*>/, "");
  expect(missingHeadTags(html)).toEqual(["title", "description", "og:image", "canonical"]);
});

test("a page belongs in the sitemap at its canonical URL unless it is noindex", () => {
  expect(sitemapEntry(fullHead)).toEqual({ url: `${siteUrl}/profile` });
  const noindex = fullHead.replace("</head>", '<meta name="robots" content="noindex"/></head>');
  expect(sitemapEntry(noindex)).toBeUndefined();
});

test("an article is in the sitemap with the day it was last changed", () => {
  const article = fullHead.replace(
    "</head>",
    '<meta property="article:modified_time" content="2026-10-10"/></head>',
  );
  expect(sitemapEntry(article)).toEqual({
    url: `${siteUrl}/profile`,
    lastModified: "2026-10-10",
  });
});

test("writes a sitemap of the entries", () => {
  expect(
    sitemapXml([
      { url: `${siteUrl}/` },
      { url: `${siteUrl}/guides/a&b`, lastModified: "2026-10-10" },
    ]),
  ).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
  <url><loc>${siteUrl}/guides/a&amp;b</loc><lastmod>2026-10-10</lastmod></url>
</urlset>
`);
});

test("counts the lists of items in a guide", () => {
  const list = '<aside aria-label="楽天市場の商品（広告）" data-guide-items="true" class="x">';
  expect(guideItemListCount(`<main>${list}</aside><p>本文</p>${list}</aside></main>`)).toBe(2);
  expect(guideItemListCount("<main><p>本文</p></main>")).toBe(0);
});

test("robots.txt lets every page be crawled and points to the sitemap", () => {
  expect(robotsTxt).toBe(`User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);
});
