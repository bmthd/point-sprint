import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { prerenderedPages } from "./src/prerender-pages.ts";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      router: { routeFileIgnorePattern: "\\.test\\." },
      prerender: { enabled: true, crawlLinks: false },
      pages: prerenderedPages.map(({ path }) => ({ path, prerender: { enabled: true } })),
    }),
    viteReact(),
  ],
  build: {
    // Yamada UI and Emotion put the shared chunk just over Vite's 500 kB default; splitting them
    // out only moves the warning to a 600 kB Yamada UI chunk. The pages are served from the device
    // cache after the first visit, so the size is accepted rather than reported on every build.
    chunkSizeWarningLimit: 600,
  },
});
