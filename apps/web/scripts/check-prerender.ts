// Fails the build when a page was not rendered to HTML, lacks a head tag every page needs or the
// Google tags, or ads.txt is missing, then writes the sitemap from the pages: each indexable page at
// its canonical URL. Run by Node, which strips the types.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { missingGoogleTagScripts } from "../src/google-tags/scripts.ts";
import {
  missingHeadTags,
  missingPrerenderedPages,
  prerenderedPages,
  sitemapEntry,
  sitemapXml,
} from "../src/prerender-pages.ts";

const clientDir = join(import.meta.dirname, "../.cloudflare/output/v0/workers/default/assets");
const missing = missingPrerenderedPages((file) => existsSync(join(clientDir, file)));
if (missing.length > 0) {
  console.error(`Prerendered pages are missing: ${missing.join(", ")}`);
  process.exit(1);
}

const problems: string[] = [];
const indexed: NonNullable<ReturnType<typeof sitemapEntry>>[] = [];
for (const { path, file } of prerenderedPages) {
  const html = readFileSync(join(clientDir, file), "utf8");
  const tags = missingHeadTags(html);
  if (tags.length > 0) problems.push(`${path} lacks ${tags.join(", ")}`);
  const scripts = missingGoogleTagScripts(html);
  if (scripts.length > 0) problems.push(`${path} does not load ${scripts.join(" or ")}`);
  const entry = sitemapEntry(html);
  if (entry !== undefined) indexed.push(entry);
}
if (!existsSync(join(clientDir, "ads.txt"))) problems.push("ads.txt is missing");
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
writeFileSync(join(clientDir, "sitemap.xml"), sitemapXml(indexed));
