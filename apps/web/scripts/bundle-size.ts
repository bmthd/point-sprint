// Writes a Markdown table of the client's sizes, before and after compression, for the job summary
// (ci.yml): all the scripts and styles the build wrote, and those the top page loads to render.
// The Worker renders the top page on request, so the build writes no HTML for it. Its files are
// read from TanStack Start's manifest instead: the preloads, scripts and styles of the top page's
// route and of the routes above it. Run by Node after `pnpm build`.
//
// `--out <file>` also writes the sizes as JSON, which the CI keeps from main's builds. `--base
// <file>` adds the difference from such a file. A file's name carries a hash of its content, so the
// breakdown compares the files by their names without it, those sharing a name summed.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { brotliCompressSync, gzipSync } from "node:zlib";

const { values: args } = parseArgs({
  options: { out: { type: "string" }, base: { type: "string" } },
});
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

type Sizes = { raw: number; gzip: number; brotli: number };
type Size = Sizes & { file: string };
type Group = { label: string; sizes: Size[] };

const groups: Group[] = [
  { label: "Whole app", sizes: allFiles.map(measure) },
  { label: "Top page, initial render", sizes: [...topPageFiles].map(measure) },
];
if (args.out !== undefined) writeFileSync(args.out, JSON.stringify({ groups }));
const baseGroups: Group[] | undefined =
  args.base === undefined ? undefined : JSON.parse(readFileSync(args.base, "utf8")).groups;

console.log(`## Client bundle size

${baseGroups === undefined ? "No build of main to compare with." : "The differences are from the latest build of main."}

| | Files | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: | ---: |
${groups.map(totalRow).join("\n")}

The top page's HTML, which the Worker renders on request, is not included.
${groups.map(breakdown).join("")}`);

function parentOf(id: string): string | undefined {
  return Object.keys(routes).find((parent) => routes[parent]?.children?.includes(id));
}

function measure(file: string): Size {
  const content = readFileSync(join(clientDir, file));
  return {
    file,
    raw: content.length,
    gzip: gzipSync(content, { level: 9 }).length,
    brotli: brotliCompressSync(content).length,
  };
}

function baseOf(label: string): Size[] | undefined {
  return baseGroups?.find((group) => group.label === label)?.sizes;
}

function totalRow({ label, sizes }: Group): string {
  const base = baseOf(label);
  const files = withChange(sizes.length, base?.length, String);
  return `| ${label} | ${files} | ${cells(sum(sizes), base && sum(base))} |`;
}

/**
 * The files of a group by their names without the hash, folded away: against main, the changed ones
 * first, then the largest first.
 */
function breakdown({ label, sizes }: Group): string {
  const current = byName(sizes);
  const base = baseOf(label);
  const previous = base && byName(base);
  const empty: Sizes = { raw: 0, gzip: 0, brotli: 0 };
  const files = [...new Set([...current.keys(), ...(previous?.keys() ?? [])])]
    .map((name) => {
      const now = current.get(name);
      const before = previous?.get(name);
      const changed = previous !== undefined && differs(now ?? empty, before ?? empty);
      return { name, now, before, changed };
    })
    .toSorted(
      (a, b) => Number(b.changed) - Number(a.changed) || (b.now?.raw ?? 0) - (a.now?.raw ?? 0),
    );
  const rows = files.map(({ name, now, before }) => {
    const note =
      now === undefined ? " (removed)" : before === undefined && previous ? " (added)" : "";
    return `| \`${name}\`${note} | ${cells(now ?? empty, previous && (before ?? empty))} |`;
  });
  const changed = files.filter((file) => file.changed).length;
  const summary = `${label}: ${files.length} names${previous === undefined ? "" : `, ${changed} changed`}`;
  return `
<details><summary>${summary}</summary>

| File | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
${rows.join("\n")}

</details>
`;
}

function byName(sizes: Size[]): Map<string, Sizes> {
  const names = new Map<string, Sizes>();
  for (const size of sizes) {
    const name = size.file.replace("/assets/", "").replace(/-[\w-]{8}(\.\w+)$/, "$1");
    names.set(name, sum([names.get(name) ?? { raw: 0, gzip: 0, brotli: 0 }, size]));
  }
  return names;
}

function sum(sizes: Sizes[]): Sizes {
  return {
    raw: sizes.reduce((total, size) => total + size.raw, 0),
    gzip: sizes.reduce((total, size) => total + size.gzip, 0),
    brotli: sizes.reduce((total, size) => total + size.brotli, 0),
  };
}

function differs(a: Sizes, b: Sizes): boolean {
  return a.raw !== b.raw || a.gzip !== b.gzip || a.brotli !== b.brotli;
}

function cells(size: Sizes, base: Sizes | undefined): string {
  return (["raw", "gzip", "brotli"] as const)
    .map((key) => withChange(size[key], base?.[key], kB))
    .join(" | ");
}

/** The value, and its change from the base when there is one. */
function withChange(
  value: number,
  base: number | undefined,
  format: (value: number) => string,
): string {
  if (base === undefined || value === base) return format(value);
  return `${format(value)} (${value > base ? "+" : "-"}${format(Math.abs(value - base))})`;
}

function kB(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}
