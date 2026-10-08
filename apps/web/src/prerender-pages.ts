/** Every route, rendered to HTML at build time. Listed so none depends on being reached by a link. */
export const prerenderedPages = [
  "/",
  "/plan",
  "/plan/settings",
  "/profile",
  "/help",
  "/terms",
  "/inquiry",
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

/**
 * The URL a page should be found at in `public/sitemap.xml`: its canonical URL, or `undefined`
 * when the page asks search engines not to index it.
 */
export const sitemapUrl = (html: string): string | undefined => {
  const noindex = headTags(html, "meta").some(
    (m) => m.name === "robots" && m.content?.includes("noindex"),
  );
  return noindex ? undefined : headTags(html, "link").find((l) => l.rel === "canonical")?.href;
};

/** The URLs a sitemap lists. */
export const sitemapUrls = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url = ""]) => url);
