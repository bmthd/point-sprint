import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fixtureFetch, guideItems } from "./src/guides/vite-plugin.ts";
import { prerenderedPages } from "./src/prerender-pages.ts";
import {
  ALLOWED_ORIGIN,
  DEV_PROXY_PATH,
  ITEM_SEARCH_ENDPOINT,
  readRakutenConfig,
} from "./src/rakuten/config.ts";
import { searchItems } from "./src/rakuten/item-search.ts";

export default defineConfig(({ mode, isPreview }) => {
  // Only the `PUBLIC_` values reach the browser. They are plain text in `.env.development` and
  // `.env.production` at the root, so they are read without the dotenvx key, also by builds that do
  // not go through `pnpm build`. Without them, no item lookup, and the guides show no items.
  const publicEnv = loadEnv(mode, "../..", "PUBLIC_");
  const rakutenConfig = readRakutenConfig(publicEnv);
  // `vite preview` serves what was built, with the settings the build had.
  if (!rakutenConfig && !isPreview) {
    console.warn(
      "Rakuten API settings are missing or encrypted: item lookup and the guides' items are off.",
    );
  }
  // The E2E build answers the guides' item searches from a file, so that no test calls the API.
  const fixture = process.env.RAKUTEN_ITEM_SEARCH_FIXTURE;
  return {
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart({
        router: { routeFileIgnorePattern: "\\.test\\." },
        prerender: { enabled: true, crawlLinks: false },
        pages: prerenderedPages.map(({ path }) => ({ path, prerender: { enabled: true } })),
      }),
      viteReact({ compiler: true }),
      guideItems({
        search:
          rakutenConfig &&
          ((params) =>
            searchItems(rakutenConfig, params, {
              origin: ALLOWED_ORIGIN,
              ...(fixture ? { fetch: fixtureFetch(fixture) } : {}),
            })),
      }),
    ],
    define: {
      "import.meta.env.RAKUTEN_CONFIG": JSON.stringify(rakutenConfig ?? null),
      // Without it, the inquiry form says it cannot take inquiries.
      "import.meta.env.TURNSTILE_SITE_KEY": JSON.stringify(
        publicEnv.PUBLIC_TURNSTILE_SITE_KEY?.trim() || null,
      ),
    },
    server: {
      proxy: {
        // The API answers only `ALLOWED_ORIGIN`, which cannot be localhost.
        [DEV_PROXY_PATH]: {
          target: new URL(ITEM_SEARCH_ENDPOINT).origin,
          changeOrigin: true,
          rewrite: (path) => path.slice(DEV_PROXY_PATH.length),
          // Lower case, to replace the browser's `origin` rather than send a second one.
          headers: { origin: ALLOWED_ORIGIN },
        },
      },
    },
    build: {
      // Yamada UI and Emotion put the shared chunk just over Vite's 500 kB default; splitting them
      // out only moves the warning to a 600 kB Yamada UI chunk. The pages are served from the device
      // cache after the first visit, so the size is accepted rather than reported on every build.
      chunkSizeWarningLimit: 600,
    },
  };
});
