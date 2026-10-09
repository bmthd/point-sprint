import { guideSlugs } from "./guides/files.ts";
import { siteUrl } from "./site-url.ts";

/**
 * Every route, rendered to HTML at build time. Listed so none depends on being reached by a link.
 * A guide is a page for each file in `src/guides/articles/`.
 */
export const prerenderedPages = [
  "/",
  "/plan",
  "/plan/settings",
  "/profile",
  "/help",
  "/terms",
  "/privacy",
  "/inquiry",
  "/notices",
  "/guides",
  ...guideSlugs().map((slug) => `/guides/${slug}`),
].map((path) => ({
  path,
  file: path === "/" ? "index.html" : `${path.slice(1)}/index.html`,
}));

/**
 * Routes the Worker renders on each request instead: what they show comes from the query string. A
 * shared result's page carries its figures in its OGP tags, and its image is drawn from them.
 */
export const pagesRenderedOnRequest = ["/share", "/share/image.png"];

/** HTML files, relative to the client output directory, that the build did not write. */
export const missingPrerenderedPages = (exists: (file: string) => boolean): string[] =>
  prerenderedPages.map((page) => page.file).filter((file) => !exists(file));

type Tag = Record<string, string>;

/** The `<meta>` and `<link>` tags of an HTML document, with their attributes. */
const headTags = (html: string, name: "meta" | "link"): Tag[] =>
  [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "g"))].map(([, attrs = ""]) =>
    Object.fromEntries(
      [...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    ),
  );

/** What every page's `<head>` needs, for search results and link previews on social media. */
const requiredMeta = {
  name: ["description", "twitter:card"],
  property: ["og:title", "og:description", "og:url", "og:image", "og:type", "og:site_name"],
} as const;
const requiredLinks = ["icon", "apple-touch-icon", "manifest", "canonical"];

/** The head tags a prerendered page lacks, by name ("title", "og:image", "canonical"…). */
export const missingHeadTags = (html: string): string[] => {
  const meta = headTags(html, "meta");
  const links = headTags(html, "link");
  const title = /<title\b[^>]*>[^<]+<\/title>/.test(html);
  const hasMeta = (key: "name" | "property", value: string) =>
    meta.some((m) => m[key] === value && m.content);
  return [
    ...(title ? [] : ["title"]),
    ...requiredMeta.name.filter((name) => !hasMeta("name", name)),
    ...requiredMeta.property.filter((property) => !hasMeta("property", property)),
    ...requiredLinks.filter((rel) => !links.some((l) => l.rel === rel && l.href)),
  ];
};

type SitemapEntry = { url: string; lastModified?: string };

/**
 * A page's entry in the sitemap: its canonical URL, and for an article the day it was last
 * changed. `undefined` when the page asks search engines not to index it.
 */
export const sitemapEntry = (html: string): SitemapEntry | undefined => {
  const meta = headTags(html, "meta");
  if (meta.some((m) => m.name === "robots" && m.content?.includes("noindex"))) return undefined;
  const url = headTags(html, "link").find((l) => l.rel === "canonical")?.href;
  if (url === undefined) return undefined;
  const lastModified = meta.find((m) => m.property === "article:modified_time")?.content;
  return lastModified ? { url, lastModified } : { url };
};

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The `sitemap.xml` that lists `entries`. */
export const sitemapXml = (entries: SitemapEntry[]) =>
  [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map(({ url, lastModified }) => {
      const lastmod = lastModified ? `<lastmod>${lastModified}</lastmod>` : "";
      return `  <url><loc>${escapeXml(url)}</loc>${lastmod}</url>`;
    }),
    `</urlset>`,
    "",
  ].join("\n");

/**
 * The `robots.txt`, pointing to the sitemap. Written by the client build, unlike the sitemap, so
 * that a Preview, which runs only the build, serves it too.
 */
export const robotsTxt = [
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${siteUrl}/sitemap.xml`,
  "",
].join("\n");

/** How many lists of Rakuten items a prerendered guide has. */
export const guideItemListCount = (html: string): number =>
  [...html.matchAll(/<aside\b[^>]*\bdata-guide-items\b/g)].length;
