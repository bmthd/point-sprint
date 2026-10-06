// Fails the build when a page was not rendered to HTML. Run by Node, which strips the types.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { missingPrerenderedPages } from "../src/prerender-pages.ts";

const clientDir = join(import.meta.dirname, "../.cloudflare/output/v0/workers/default/assets");
const missing = missingPrerenderedPages((file) => existsSync(join(clientDir, file)));
if (missing.length > 0) {
  console.error(`Prerendered pages are missing: ${missing.join(", ")}`);
  process.exit(1);
}
