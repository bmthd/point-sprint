declare global {
  interface Window {
    /** Defined by the inline Google Analytics snippet in production builds only. */
    gtag?: (...args: unknown[]) => void;
    /** The AdSense queue: each pushed object asks AdSense to fill one more ad unit. */
    adsbygoogle?: object[];
  }

  interface ImportMetaEnv {
    /** Set by vite.config.ts for production builds only. */
    readonly GA_MEASUREMENT_ID?: string;
    readonly ADSENSE_CLIENT_ID?: string;
  }
}

export {};
