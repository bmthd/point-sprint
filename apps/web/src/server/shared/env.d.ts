interface ImportMetaEnv {
  /**
   * Where the item lookup calls instead of the API, put in by the build (`vite.config.ts`). The
   * E2E build points it at a stand-in server, so that no test calls the API.
   */
  readonly ITEM_LOOKUP_ENDPOINT?: string | null;
  /**
   * `RAKUTEN_AFFILIATE_ID`, put in by the build. Not a secret: it is in every affiliate link, so it
   * is plain text in the `.env` files and needs no key to read.
   */
  readonly RAKUTEN_AFFILIATE_ID?: string | null;
}
