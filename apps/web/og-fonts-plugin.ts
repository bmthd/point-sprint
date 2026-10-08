import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import subsetFont from "subset-font";
import type { Plugin } from "vite";
import { cardGlyphs } from "./src/share/card-glyphs.ts";

const id = "virtual:og-fonts";
const resolvedId = `\0${id}`;

const weights = { 400: "400Regular", 700: "700Bold" } as const;

/**
 * `virtual:og-fonts`: Noto Sans JP for the result's OGP image, cut down to `cardGlyphs`. The whole
 * font is megabytes per weight, too much for the Worker; the card draws only a few dozen letters,
 * which come to a few kilobytes. The fonts are base64 in the module, as the Worker has no files.
 */
export function ogFonts(): Plugin {
  const require = createRequire(import.meta.url);
  return {
    name: "og-fonts",
    resolveId: (source) => (source === id ? resolvedId : undefined),
    async load(loadedId) {
      if (loadedId !== resolvedId) return undefined;
      const fonts = await Promise.all(
        Object.entries(weights).map(async ([weight, name]) => {
          const file = require.resolve(
            `@expo-google-fonts/noto-sans-jp/${name}/NotoSansJP_${name}.ttf`,
          );
          const data = await subsetFont(await readFile(file), cardGlyphs, {
            targetFormat: "woff2",
          });
          return { weight: Number(weight), data: data.toString("base64") };
        }),
      );
      return `export default ${JSON.stringify(fonts)};`;
    },
  };
}
