import { expect, test } from "vitest";
import { getRouter } from "./router";
import {
  missingHeadTags,
  missingPrerenderedPages,
  prerenderedPages,
  sitemapUrl,
  sitemapUrls,
} from "./prerender-pages";

test("every route is prerendered", () => {
  const routePaths = Object.keys(getRouter().routesByPath).map((path) =>
    path.length > 1 ? path.replace(/\/$/, "") : path,
  );
  expect(prerenderedPages.map((page) => page.path).toSorted()).toEqual(
    [...new Set(routePaths)].toSorted(),
  );
});

test("lists the pages whose HTML file is missing", () => {
  const built = new Set([
    "index.html",
    "plan/index.html",
    "profile/index.html",
    "inquiry/index.html",
  ]);
  expect(missingPrerenderedPages((file) => built.has(file))).toEqual(["plan/settings/index.html"]);
});

const fullHead = `<head>
<title>プロフィール | ポイントスプリント</title>
<meta name="description" content="説明"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="ポイントスプリント"/>
<meta property="og:title" content="プロフィール | ポイントスプリント"/>
<meta property="og:description" content="説明"/>
<meta property="og:url" content="https://point-sprint.bmth.dev/profile"/>
<meta property="og:image" content="https://point-sprint.bmth.dev/opengraph-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="manifest" href="/manifest.json"/>
<link rel="canonical" href="https://point-sprint.bmth.dev/profile"/>
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
  expect(sitemapUrl(fullHead)).toBe("https://point-sprint.bmth.dev/profile");
  const noindex = fullHead.replace("</head>", '<meta name="robots" content="noindex"/></head>');
  expect(sitemapUrl(noindex)).toBeUndefined();
});

test("reads the URLs of a sitemap", () => {
  const xml = `<urlset><url><loc>https://point-sprint.bmth.dev/</loc></url>
  <url><loc>https://point-sprint.bmth.dev/profile</loc></url></urlset>`;
  expect(sitemapUrls(xml)).toEqual([
    "https://point-sprint.bmth.dev/",
    "https://point-sprint.bmth.dev/profile",
  ]);
});
