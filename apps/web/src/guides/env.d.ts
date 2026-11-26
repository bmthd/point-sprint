interface ImportMetaEnv {
  /**
   * Where the guides' item searches go instead of the API, put in by the build (`vite.config.ts`).
   * The E2E build points it at nowhere, so that no test calls the API.
   */
  readonly GUIDE_ITEMS_ENDPOINT?: string | null;
  /** Each guide's dates by its slug, read from the git log by the build (`git-dates.ts`). */
  readonly GUIDE_DATES: Record<string, import("./article.ts").ArticleDates>;
}
