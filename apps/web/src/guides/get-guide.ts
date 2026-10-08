import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/**
 * A guide, with the items of its lists, which only the build searches (`guide-on-server.ts`).
 * The pages link to a guide as a page of its own, so the prerendered HTML is what a reader sees.
 */
export const getGuide = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    // Loaded here: it is the server's alone, and calls the API.
    const { loadGuideOnServer } = await import("./guide-on-server");
    const guide = await loadGuideOnServer(slug);
    if (!guide) throw notFound();
    return guide;
  });
