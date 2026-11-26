import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tokyoToday } from "#/ui/dates.ts";
import { type ArticleDates, articleDates } from "./article.ts";
import { guideSlugs } from "./files.ts";

// The days each guide was published and changed, read by the build (Node) from the git log.
//
// A commit's day is its committer date in Japan: on main, a squashed pull request is committed
// when it is merged, so the days are those the changes reached the site, not those they were
// written. Every commit that changes the file counts as a change.

const articlesDir = fileURLToPath(new URL("./articles/", import.meta.url));

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: articlesDir, encoding: "utf8" }).trim();

/**
 * The dates of every guide, by its slug. Throws in a shallow clone, whose log would date every
 * guide to its last commit: the checkout needs the whole history (`fetch-depth: 0`).
 */
export function gitArticleDates(now = new Date()): Record<string, ArticleDates> {
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    throw new Error(
      "The guides' dates are read from the git log, which this shallow clone lacks: fetch the whole history",
    );
  }
  const today = tokyoToday(now);
  return Object.fromEntries(
    guideSlugs().map((slug) => {
      const days = git("log", "--follow", "--format=%cI", "--", `${slug}.md`)
        .split("\n")
        .filter(Boolean)
        .map((date) => tokyoToday(new Date(date)));
      return [slug, articleDates(days, today)];
    }),
  );
}
