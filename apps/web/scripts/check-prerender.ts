// Fails the build when a page was not rendered to HTML, lacks a head tag every page needs, or is
// missing from (or wrongly in) the sitemap. Run by Node, which strips the types.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  missingHeadTags,
  missingPrerenderedPages,
  prerenderedPages,
  sitemapUrl,
  sitemapUrls,
} from "../src/prerender-pages.ts";

const clientDir = join(import.meta.dirname, "../.cloudflare/output/v0/workers/default/assets");
const missing = missingPrerenderedPages((file) => existsSync(join(clientDir, file)));
if (missing.length > 0) {
  console.error(`Prerendered pages are missing: ${missing.join(", ")}`);
  process.exit(1);
}

const problems: string[] = [];
const indexed: string[] = [];
for (const { path, file } of prerenderedPages) {
  const html = readFileSync(join(clientDir, file), "utf8");
  const tags = missingHeadTags(html);
  if (tags.length > 0) problems.push(`${path} lacks ${tags.join(", ")}`);
  const url = sitemapUrl(html);
  if (url !== undefined) indexed.push(url);
}
const listed = sitemapUrls(readFileSync(join(clientDir, "sitemap.xml"), "utf8"));
for (const url of indexed.filter((url) => !listed.includes(url)))
  problems.push(`public/sitemap.xml does not list ${url}`);
for (const url of listed.filter((url) => !indexed.includes(url)))
  problems.push(`public/sitemap.xml lists ${url}, which is not an indexable prerendered page`);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
