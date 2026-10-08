import { createFileRoute } from "@tanstack/react-router";
import { renderResultImage } from "../features/share/result-image";
import { resultImageRequest } from "../features/share/result-card";

/** The same figures always draw the same image. */
const cacheControl = "public, max-age=86400";

/** The Worker's cache in this data center. There is none outside the Workers runtime. */
const workerCache = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

/** The OGP image of a shared result, drawn by the Worker from the figures in the query string. */
export const Route = createFileRoute("/share_/image.png")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const image = resultImageRequest(url);
        if (!image) return new Response("Not Found", { status: 404 });
        // Every spelling of the same figures is sent to one URL, so that the caches hold each
        // image once and a new query string cannot make the Worker draw it again.
        if (`${url.pathname}${url.search}` !== image.path) {
          return new Response(null, {
            status: 301,
            headers: { location: image.path, "cache-control": cacheControl },
          });
        }

        const cache = workerCache();
        const key = new Request(new URL(image.path, url));
        const cached = await cache?.match(key);
        if (cached) return cached;

        const png = await renderResultImage(image.figures);
        const headers = { "content-type": "image/png", "cache-control": cacheControl };
        await cache?.put(key, new Response(png, { headers }));
        return new Response(png, { headers });
      },
    },
  },
});
