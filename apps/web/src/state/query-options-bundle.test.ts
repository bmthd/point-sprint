import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { expect, test } from "vitest";

test("a factory-only bundle removes unused queries, atoms and storage implementations", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = fileURLToPath(new URL("./queries.ts", import.meta.url));
  const entry = join(root, "query-options-probe");
  const result = await build({
    root,
    configFile: false,
    logLevel: "error",
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ["es"], fileName: "probe" },
    },
    plugins: [
      {
        name: "query-options-probe",
        resolveId(id) {
          if (id === entry) return "\0query-options-probe";
        },
        load(id) {
          if (id === "\0query-options-probe")
            return `export { plansQueryOptions } from ${JSON.stringify(source)}`;
        },
      },
    ],
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap((output) => {
    if (!("output" in output)) throw new Error("Expected a completed library build");
    return output.output.filter((item) => item.type === "chunk");
  });
  const modules = chunks.flatMap((chunk) =>
    Object.entries(chunk.modules).filter(([, info]) => info.renderedLength > 0),
  );
  const unwanted = modules
    .map(([id]) => id)
    .filter(
      (id) =>
        /node_modules\/(?:\.pnpm\/)?(?:jotai|react|@yamada-ui|@emotion)/.test(id) ||
        id.includes("/src/storage/") ||
        id.includes("/packages/ui/") ||
        /\/state\/(?:query-atoms|repository|sync)\.ts$/.test(id),
    );
  expect(unwanted).toEqual([]);
  expect(chunks.filter((chunk) => chunk.isEntry).flatMap((chunk) => chunk.exports)).toEqual([
    "plansQueryOptions",
  ]);
  const queryModule = modules.find(([id]) => id === source)?.[1];
  expect(queryModule?.renderedExports.filter((name) => name.endsWith("QueryOptions"))).toEqual([
    "plansQueryOptions",
  ]);
});
