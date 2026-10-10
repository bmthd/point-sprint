import type { GoogleTagIds } from "./env";

/** Filled in by vite.config.ts for production builds; undefined in development and tests. */
export const googleTagIds: GoogleTagIds = {
  measurementId: import.meta.env.GA_MEASUREMENT_ID,
  adsenseClientId: import.meta.env.ADSENSE_CLIENT_ID,
};
