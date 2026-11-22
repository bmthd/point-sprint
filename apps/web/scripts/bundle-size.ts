// Writes a Markdown table of the client's sizes, before and after compression, for the job summary
// (ci.yml): all the scripts and styles the build wrote, and those the top page loads to render.
// The Worker renders the top page on request, so the build writes no HTML for it. Its files are
// read from TanStack Start's manifest instead: the preloads, scripts and styles of the top page's
// route and of the routes above it. Run by Node after `pnpm build`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const outputDir = join(import.meta.dirname, "../.cloudflare/output/v0/workers/default");
const clientDir = join(outputDir, "assets");
const topPageRoute = "/(site)/";

type Route = {
  children?: string[];
  preloads?: string[];
  scripts?: { attrs?: { src?: string } }[];
  assets?: { tag: string; attrs?: { href?: string } }[];
};

const allFiles = readdirSync(join(clientDir, "assets"))
  .filter((name) => /\.(js|css)$/.test(name))
  .map((name) => `/assets/${name}`);

const manifestDir = join(outputDir, "bundle/assets");
const manifestFile = readdirSync(manifestDir).find((name) =>
  /^_tanstack-start-manifest.*\.js$/.test(name),
);
if (manifestFile === undefined) throw new Error(`No TanStack Start manifest in ${manifestDir}`);
const { tsrStartManifest } = await import(pathToFileURL(join(manifestDir, manifestFile)).href);
const routes: Record<string, Route> = tsrStartManifest().routes;

const topPageFiles = new Set<string>();
for (let id: string | undefined = topPageRoute; id !== undefined; id = parentOf(id)) {
  const route = routes[id];
  if (route === undefined) throw new Error(`No route ${id} in the TanStack Start manifest`);
  for (const file of route.preloads ?? []) topPageFiles.add(file);
  for (const script of route.scripts ?? []) {
    if (script.attrs?.src) topPageFiles.add(script.attrs.src);
  }
  for (const asset of route.assets ?? []) {
    if (asset.tag === "link" && asset.attrs?.href) topPageFiles.add(asset.attrs.href);
  }
}

console.log(`## Client bundle size

| | Files | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: | ---: |
${row("Whole app", allFiles)}
${row("Top page, initial render", [...topPageFiles])}

The top page's HTML, which the Worker renders on request, is not included.`);

function parentOf(id: string): string | undefined {
  return Object.keys(routes).find((parent) => routes[parent]?.children?.includes(id));
}

function row(label: string, files: string[]): string {
  let raw = 0;
  let gzip = 0;
  let brotli = 0;
  for (const file of files) {
    const content = readFileSync(join(clientDir, file));
    raw += content.length;
    gzip += gzipSync(content, { level: 9 }).length;
    brotli += brotliCompressSync(content).length;
  }
  return `| ${label} | ${files.length} | ${kB(raw)} | ${kB(gzip)} | ${kB(brotli)} |`;
}

function kB(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}
