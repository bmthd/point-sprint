import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

/**
 * A guide, with the items of its lists, which only the build searches (`guide.worker.ts`).
 * The pages link to a guide as a page of its own, so the prerendered HTML is what a reader sees.
 */
export const getGuide = createServerFn({ method: "GET" })
  .validator(v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)))
  .handler(async ({ data: slug }) => {
    // Handler imports: see ../server/shared/README.md.
    const { loadGuideOnServer } = await import("./guide.worker");
    const guide = await loadGuideOnServer(slug);
    if (!guide) throw notFound();
    return guide;
  });
