import { createServerFn } from "@tanstack/react-start";

/**
 * The cards of the newest guides for the top page. Read on the server, so moving to the top page
 * in the browser fetches the cards alone, not every guide's text.
 */
export const getGuideCards = createServerFn({ method: "GET" }).handler(async () => {
  // Handler imports: see ../../../../docs/server-imports.md.
  const [{ loadArticles }, { guideCards }] = await Promise.all([
    import("./articles"),
    import("./guide-cards"),
  ]);
  return guideCards(await loadArticles());
});
