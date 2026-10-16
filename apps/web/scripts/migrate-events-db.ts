// Applies migrations/ to the event master's D1: production's, or a Preview's with `--preview`,
// through `cf`. With `--local`, makes the local one the dev server and `vite preview` use afresh
// and runs every migration on it through Miniflare: `cf` 1.0.0-beta.12 often hangs on a local
// database. Run by Node, which strips the types.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { EVENTS_DB, PREVIEW_EVENTS_DB } from "../cloudflare.config.ts";
import { localStateDir } from "./local-state-dir.ts";

const args = new Set(process.argv.slice(2));

if (args.has("--local")) {
  const stateDir = localStateDir(process.env);
  // Only the D1 data: the other bindings' stays.
  rmSync(join(stateDir, "v3", "d1"), { recursive: true, force: true });
  // The dev server and `vite preview` are not Previews, so they bind production's id, locally.
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default {}",
      d1Databases: { EVENTS_DB: EVENTS_DB.id },
      // Where the Vite plugin keeps them (`persistState` in vite.config.ts).
      resourcePersistencePath: join(stateDir, "v3"),
    }),
  );
  try {
    const db = await miniflare.getD1Database("EVENTS_DB");
    const files = readdirSync("migrations")
      .filter((file) => file.endsWith(".sql"))
      .toSorted();
    for (const file of files) {
      // `exec` takes one statement a line, so each is joined onto one line.
      const sql = readFileSync(join("migrations", file), "utf8")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join(" ");
      for (const statement of sql.split(/;\s*(?=\S|$)/).filter((s) => s.trim())) {
        await db.prepare(statement).run();
      }
      console.log(`Applied ${file} to the local event master.`);
    }
  } finally {
    await miniflare.dispose();
  }
} else {
  const { id } = args.has("--preview") ? PREVIEW_EVENTS_DB : EVENTS_DB;
  execFileSync("pnpm", ["exec", "cf", "d1", "migrations", "apply", id], {
    // No input: cf then applies them without asking whether to go on.
    stdio: ["ignore", "inherit", "inherit"],
  });
}
