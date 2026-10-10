// Also imported by scripts/check-prerender.ts, which Node runs directly: keep this file free of imports.

type HeadScript = { src?: string; async?: boolean; crossOrigin?: "anonymous"; children?: string };

const GTAG_SRC = "https://www.googletagmanager.com/gtag/js?id=";
const ADSENSE_SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=";

/**
 * Head scripts for Google Analytics and AdSense, loaded `async` so they never hold up the page.
 * Without IDs (development and tests) it returns none. The IDs are validated, so they are safe to
 * put inside the inline script.
 *
 * The `config` call sends the page_view of the first load. Page views of later client-side
 * route changes come from GA4 Enhanced measurement ("Page changes based on browser history events"),
 * which must stay ON in the GA4 stream settings; the app sends no page_view of its own, so nothing
 * is counted twice.
 */
export function googleTagScripts({
  measurementId,
  adsenseClientId,
}: {
  measurementId?: string;
  adsenseClientId?: string;
}): HeadScript[] {
  const scripts: HeadScript[] = [];
  if (measurementId) {
    scripts.push(
      { src: `${GTAG_SRC}${measurementId}`, async: true },
      {
        // Guarded so that running it twice cannot send a second page_view.
        children: `if(!window.gtag){window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${measurementId}');}`,
      },
    );
  }
  if (adsenseClientId) {
    scripts.push({
      src: `${ADSENSE_SRC}${adsenseClientId}`,
      async: true,
      crossOrigin: "anonymous",
    });
  }
  return scripts;
}

/** Names of the Google tag scripts that a built HTML page does not load. */
export function missingGoogleTagScripts(html: string): string[] {
  return [
    { name: "gtag.js", src: GTAG_SRC },
    { name: "AdSense", src: ADSENSE_SRC },
  ]
    .filter(({ src }) => !html.includes(src))
    .map(({ name }) => name);
}
