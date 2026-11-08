import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { render } from "takumi-js";
import type { Plugin } from "vite";
import { parseArticle } from "#/guides/article.ts";
import { guideSlugs } from "#/guides/files.ts";
import {
  thumbnail,
  thumbnailFontFamily,
  thumbnailFontWeights,
  thumbnailPath,
  thumbnailSize,
} from "#/guides/thumbnail.ts";

const weightNames = { 700: "700Bold", 900: "900Black" } as const;

/**
 * Each guide's thumbnail (`thumbnail.ts`), drawn by the build into `/guides/<slug>/thumbnail.png`
 * and served as a file, so that no request runs the Worker. It is drawn in Node with the whole of
 * Noto Sans JP, which the Worker could not hold. The dev server draws one when it is asked for.
 */
export function guideThumbnails(): Plugin {
  const require = createRequire(import.meta.url);
  let fonts: Promise<{ name: string; weight: number; data: Buffer }[]> | undefined;
  const loadFonts = () =>
    (fonts ??= Promise.all(
      thumbnailFontWeights.map(async (weight) => {
        const name = weightNames[weight];
        const file = require.resolve(
          `@expo-google-fonts/noto-sans-jp/${name}/NotoSansJP_${name}.ttf`,
        );
        return { name: thumbnailFontFamily, weight, data: await readFile(file) };
      }),
    ));

  const draw = async (slug: string) => {
    const source = await readFile(new URL(`./src/guides/articles/${slug}.md`, import.meta.url));
    const article = parseArticle(slug, source.toString());
    return render(thumbnail(article), {
      ...thumbnailSize,
      format: "png",
      fonts: await loadFonts(),
    });
  };

  return {
    name: "guide-thumbnails",
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      for (const slug of guideSlugs()) {
        this.emitFile({
          type: "asset",
          // Without the leading slash: a path in the output directory.
          fileName: thumbnailPath(slug).slice(1),
          source: await draw(slug),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const slug = guideSlugs().find((slug) => request.url === thumbnailPath(slug));
        if (!slug) return next();
        try {
          response.setHeader("content-type", "image/png");
          response.end(await draw(slug));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
