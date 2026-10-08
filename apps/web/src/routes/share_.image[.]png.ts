import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { renderResultImage } from "../features/share/result-image";
import { resultFigures, resultSearchSchema } from "../share/result-card";

/** The OGP image of a shared result, drawn by the Worker from the figures in the query string. */
export const Route = createFileRoute("/share_/image.png")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const search = Object.fromEntries(new URL(request.url).searchParams);
        const figures = resultFigures(v.parse(resultSearchSchema, search));
        if (!figures) return new Response("Not Found", { status: 404 });
        return new Response(await renderResultImage(figures), {
          headers: {
            "content-type": "image/png",
            // The same figures always draw the same image.
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
