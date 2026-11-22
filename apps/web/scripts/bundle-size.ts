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

const groups = [
  { label: "Whole app", sizes: allFiles.map(measure) },
  { label: "Top page, initial render", sizes: [...topPageFiles].map(measure) },
];

console.log(`## Client bundle size

| | Files | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: | ---: |
${groups.map(({ label, sizes }) => row(label, sizes.length, total(sizes))).join("\n")}

The top page's HTML, which the Worker renders on request, is not included.
${groups.map(({ label, sizes }) => breakdown(label, sizes)).join("")}`);

function parentOf(id: string): string | undefined {
  return Object.keys(routes).find((parent) => routes[parent]?.children?.includes(id));
}

type Size = { file: string; raw: number; gzip: number; brotli: number };

function measure(file: string): Size {
  const content = readFileSync(join(clientDir, file));
  return {
    file,
    raw: content.length,
    gzip: gzipSync(content, { level: 9 }).length,
    brotli: brotliCompressSync(content).length,
  };
}

function total(sizes: Size[]): Omit<Size, "file"> {
  return {
    raw: sizes.reduce((sum, size) => sum + size.raw, 0),
    gzip: sizes.reduce((sum, size) => sum + size.gzip, 0),
    brotli: sizes.reduce((sum, size) => sum + size.brotli, 0),
  };
}

function row(label: string, files: number, size: Omit<Size, "file">): string {
  return `| ${label} | ${files} | ${kB(size.raw)} | ${kB(size.gzip)} | ${kB(size.brotli)} |`;
}

/** The files of a group, the largest first, folded away. */
function breakdown(label: string, sizes: Size[]): string {
  const rows = sizes
    .toSorted((a, b) => b.raw - a.raw)
    .map(
      (size) =>
        `| \`${size.file.replace("/assets/", "")}\` | ${kB(size.raw)} | ${kB(size.gzip)} | ${kB(size.brotli)} |`,
    );
  return `
<details><summary>${label}: ${sizes.length} files</summary>

| File | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
${rows.join("\n")}

</details>
`;
}

function kB(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}
