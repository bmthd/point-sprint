interface ImportMetaEnv {
  /** Turnstile's site key, put in by the build (`vite.config.ts`); not set in tests. */
  readonly TURNSTILE_SITE_KEY?: string | null;
}
