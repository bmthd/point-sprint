import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { guideFiles } from "./files.ts";
import { type GuideItems, type ItemSearch, collectGuideItems } from "./guide-items.ts";

const MODULE_ID = "virtual:guide-items";
const RESOLVED_ID = `\0${MODULE_ID}`;

/**
 * Provides `virtual:guide-items`: the items of every guide's lists, fetched with `search` when the
 * module is first loaded. The client and the server builds share the one fetch, and the
 * prerendered pages hold its items.
 */
export function guideItems({ search }: { search: ItemSearch | undefined }): Plugin {
  let collected: Promise<GuideItems> | undefined;
  return {
    name: "guide-items",
    resolveId: (source) => (source === MODULE_ID ? RESOLVED_ID : undefined),
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const files = guideFiles();
      for (const file of files) this.addWatchFile(file.path);
      collected ??= collectGuideItems(
        files.map((file) => file.source),
        search,
      );
      return `export default ${JSON.stringify(await collected)};`;
    },
    // The dev server fetches again after a guide is changed.
    watchChange(id) {
      if (id.endsWith(".md")) collected = undefined;
    },
  };
}

/**
 * A `fetch` that answers the item search from a JSON file instead of the API: a list of
 * `{ "match": { "<parameter>": "<value>" }, "body": { "Items": [...] } }`, the first whose
 * parameters the call has giving its body, and 500 when none does. The E2E build uses it, so that
 * no test calls the real API.
 */
export function fixtureFetch(file: string): typeof fetch {
  const fixtures: { match: Record<string, string>; body: unknown }[] = JSON.parse(
    readFileSync(file, "utf8"),
  );
  return async (input) => {
    const params = new URL(input instanceof Request ? input.url : String(input)).searchParams;
    const fixture = fixtures.find(({ match }) =>
      Object.entries(match).every(([name, value]) => params.get(name) === value),
    );
    return fixture ? Response.json(fixture.body) : new Response("{}", { status: 500 });
  };
}
