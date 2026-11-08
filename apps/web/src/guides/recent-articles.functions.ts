import { createServerFn } from "@tanstack/react-start";

/** The articles the sidebar lists, read on the server so the browser never loads their text. */
export const getRecentArticles = createServerFn({ method: "GET" }).handler(async () => {
  // Handler imports: see ../../../../docs/server-imports.md.
  const [{ loadArticles }, { recentArticles }] = await Promise.all([
    import("./articles.ts"),
    import("./recent-articles.ts"),
  ]);
  return recentArticles(await loadArticles());
});
