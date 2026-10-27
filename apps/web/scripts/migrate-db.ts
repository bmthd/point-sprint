// Applies migrations/ to the event master's D1 and migrations-sync/ to the sync's D1: production's,
// or a Preview's with `--preview`, through `cf`. With `--local`, makes the local ones the dev server
// and `vite preview` use afresh and runs every migration on them through Miniflare
// (src/server/shared/migrations.ts): `cf` 1.0.0-beta.12 often hangs on a local database. Run by Node,
// which strips the types.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { EVENTS_DB, PREVIEW_EVENTS_DB, PREVIEW_SYNC_DB, SYNC_DB } from "../cloudflare.config.ts";
import { applyMigrations } from "../src/server/shared/migrations.ts";
import { localStateDir } from "./local-state-dir.ts";

const args = new Set(process.argv.slice(2));

const databases = [
  { binding: "EVENTS_DB", dir: "migrations", production: EVENTS_DB, preview: PREVIEW_EVENTS_DB },
  { binding: "SYNC_DB", dir: "migrations-sync", production: SYNC_DB, preview: PREVIEW_SYNC_DB },
] as const;

if (args.has("--local")) {
  const stateDir = localStateDir(process.env);
  // Only the D1 data: the other bindings' stays.
  rmSync(join(stateDir, "v3", "d1"), { recursive: true, force: true });
  // The dev server and `vite preview` are not Previews, so they bind production's ids, locally.
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default {}",
      d1Databases: Object.fromEntries(
        databases.map(({ binding, production }) => [binding, production.id]),
      ),
      // Where the Vite plugin keeps them (`persistState` in vite.config.ts).
      resourcePersistencePath: join(stateDir, "v3"),
    }),
  );
  try {
    for (const { binding, dir } of databases) {
      const db = await miniflare.getD1Database(binding);
      const files = readdirSync(dir).filter((file) => file.endsWith(".sql"));
      const applied = await applyMigrations(
        db,
        Object.fromEntries(files.map((file) => [file, readFileSync(join(dir, file), "utf8")])),
      );
      for (const file of applied) console.log(`Applied ${dir}/${file} to the local ${binding}.`);
    }
  } finally {
    await miniflare.dispose();
  }
} else {
  for (const { dir, production, preview } of databases) {
    const { id } = args.has("--preview") ? preview : production;
    execFileSync("pnpm", ["exec", "cf", "d1", "migrations", "apply", id, "--dir", dir], {
      // No input: cf then applies them without asking whether to go on.
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
}
