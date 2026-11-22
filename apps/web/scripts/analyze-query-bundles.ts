// Run from apps/web with dotenvx, just like the production build:
// pnpm exec dotenvx run -q -f ../../.env.development -- node scripts/analyze-query-bundles.ts --out /tmp/query-bundles
// Run the same script on both revisions. Fixed build defines keep hashes comparable.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { build, createBuilder } from "vite";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    "probe-only": { type: "boolean", default: false },
    "assert-isolated": { type: "boolean", default: false },
  },
});
if (!values.out) throw new Error("--out is required");
const out = resolve(values.out);
const root = fileURLToPath(new URL("..", import.meta.url));
mkdirSync(out, { recursive: true });
process.chdir(root);

if (!values["probe-only"]) {
  const builder = await createBuilder({
    root,
    configFile: join(root, "vite.config.ts"),
    define: {
      "import.meta.env.BUILD_ID": JSON.stringify("query-module-audit"),
      "import.meta.env.BUILD_DATE": JSON.stringify("2026-11-22"),
    },
    plugins: [
      {
        name: "query-module-analysis",
        applyToEnvironment: (environment) => environment.name === "client",
        generateBundle(_options, bundle) {
          const chunks = Object.values(bundle).flatMap((chunk) =>
            chunk.type === "chunk"
              ? [
                  {
                    file: chunk.fileName,
                    imports: chunk.imports,
                    dynamicImports: chunk.dynamicImports,
                    modules: Object.entries(chunk.modules).map(([id, info]) => ({
                      id: id.replaceAll(root, "<web>"),
                      renderedLength: info.renderedLength,
                      renderedExports: info.renderedExports,
                    })),
                  },
                ]
              : [],
          );
          writeFileSync(join(out, "app-modules.json"), JSON.stringify(chunks, null, 2));
        },
      },
    ],
  });
  await builder.buildApp();
  execFileSync(process.execPath, ["scripts/check-prerender.ts"], { stdio: "inherit" });
  writeFileSync(
    join(out, "app-sizes.md"),
    execFileSync(
      process.execPath,
      ["scripts/bundle-size.ts", "--out", join(out, "app-sizes.json")],
      { encoding: "utf8" },
    ),
  );
}

const result = await build({
  root,
  configFile: false,
  logLevel: "error",
  build: {
    write: false,
    minify: true,
    lib: { entry: "query-options-probe", formats: ["es"], fileName: "probe" },
  },
  plugins: [
    {
      name: "query-options-probe",
      resolveId(id) {
        if (id === "query-options-probe" || id === join(root, "query-options-probe"))
          return "\0query-options-probe";
      },
      load(id) {
        if (id === "\0query-options-probe")
          return `export { plansQueryOptions } from ${JSON.stringify(join(root, "src/state/queries.ts"))}`;
      },
    },
  ],
});
const outputs = Array.isArray(result) ? result : [result];
const chunks = outputs.flatMap((output) => {
  if (!("output" in output)) throw new Error("Expected probe output");
  return output.output.filter((item) => item.type === "chunk");
});
const code = chunks.map((chunk) => chunk.code).join("\n");
const modules = chunks.flatMap((chunk) =>
  Object.entries(chunk.modules).map(([id, info]) => ({
    id: id.replaceAll(root, "<web>"),
    renderedLength: info.renderedLength,
    renderedExports: info.renderedExports,
  })),
);
const forbidden = modules.filter(
  ({ id, renderedLength }) =>
    renderedLength > 0 &&
    (/node_modules\/(?:\.pnpm\/)?(?:jotai|react|@yamada-ui|@emotion)/.test(id) ||
      /\/(?:query-atoms|repository|memory-repository|sync)\.ts$/.test(id)),
);
writeFileSync(join(out, "probe.js"), code);
const unusedFactories = modules.flatMap(({ id, renderedExports }) =>
  id.endsWith("src/state/queries.ts")
    ? renderedExports.filter(
        (name) => name.endsWith("QueryOptions") && name !== "plansQueryOptions",
      )
    : [],
);
const report = {
  raw: Buffer.byteLength(code),
  gzip: gzipSync(code, { level: 9 }).length,
  brotli: brotliCompressSync(code).length,
  forbidden,
  unusedFactories,
  modules,
};
writeFileSync(join(out, "probe.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      probe: {
        raw: report.raw,
        gzip: report.gzip,
        brotli: report.brotli,
        forbidden: forbidden.map(({ id }) => id),
      },
    },
    null,
    2,
  ),
);
if (values["assert-isolated"] && (forbidden.length > 0 || unusedFactories.length > 0))
  throw new Error("Query Options import retained atom, React or storage implementation modules");
