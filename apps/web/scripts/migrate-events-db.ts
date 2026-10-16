// Applies migrations/ to the event master's D1: production's, a Preview's with `--preview`, or the
// local one the dev server and `vite preview` use with `--local`. The local one is made afresh each
// time, as `cf` 1.0.0-beta.12 does not exit when it has no migration to apply locally. Run by Node,
// which strips the types.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { EVENTS_DB, PREVIEW_EVENTS_DB } from "../cloudflare.config.ts";
import { localStateDir } from "./local-state-dir.ts";

const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const stateDir = localStateDir(process.env);
// Only the D1 data: the other bindings' stays.
if (local) rmSync(join(stateDir, "v3", "d1"), { recursive: true, force: true });
// The dev server and `vite preview` are not Previews, so they bind production's id, locally.
const { id } = args.has("--preview") ? PREVIEW_EVENTS_DB : EVENTS_DB;
execFileSync(
  "pnpm",
  [
    "exec",
    "cf",
    "d1",
    "migrations",
    "apply",
    id,
    ...(local ? ["--local", "--persist-to", stateDir] : []),
  ],
  // No input: cf then applies them without asking whether to go on.
  { stdio: ["ignore", "inherit", "inherit"] },
);
