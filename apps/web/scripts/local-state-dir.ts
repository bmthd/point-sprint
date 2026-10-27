/**
 * Where the local bindings keep their data, for the dev server, `vite preview` and the migrations:
 * `LOCAL_STATE_DIR`, which the E2E tests set (playwright.config.ts). Free of imports, so that the
 * Vite config can load it without type-checking `cloudflare.config.ts`.
 */
export function localStateDir(env: Record<string, string | undefined>) {
  return env.LOCAL_STATE_DIR || ".cloudflare/state";
}
