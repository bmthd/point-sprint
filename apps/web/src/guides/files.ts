import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The guides as files, for the build (Node): the pages to prerender, and the items to fetch.

const articlesDir = new URL("./articles/", import.meta.url);

/** Every guide's Markdown file, by its slug. */
export const guideFiles = () =>
  readdirSync(articlesDir)
    .filter((file) => file.endsWith(".md"))
    .toSorted()
    .map((file) => {
      const url = new URL(file, articlesDir);
      return {
        slug: file.slice(0, -".md".length),
        path: fileURLToPath(url),
        source: readFileSync(url, "utf8"),
      };
    });
