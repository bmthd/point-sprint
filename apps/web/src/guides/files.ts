import { readdirSync } from "node:fs";

// The guides as files, for the build (Node), which prerenders a page for each.

/** The slug of every guide in `articles/`: `1000yen-items.md` is `1000yen-items`. */
export const guideSlugs = () =>
  readdirSync(new URL("./articles/", import.meta.url))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))
    .toSorted();
