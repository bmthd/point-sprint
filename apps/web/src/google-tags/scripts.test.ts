import { expect, test } from "vitest";
import { googleTagScripts, missingGoogleTagScripts } from "./scripts";

const ids = { measurementId: "G-B6CYR6VF70", adsenseClientId: "ca-pub-8953986206743618" };

test("loads gtag.js and AdSense asynchronously", () => {
  const scripts = googleTagScripts(ids);
  expect(scripts).toContainEqual({
    src: "https://www.googletagmanager.com/gtag/js?id=G-B6CYR6VF70",
    async: true,
  });
  expect(scripts).toContainEqual({
    src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8953986206743618",
    async: true,
    crossOrigin: "anonymous",
  });
  const inline = scripts.flatMap((script) => (script.children ? [script.children] : []));
  expect(inline).toHaveLength(1);
  // One config call; navigation page views are left to GA4 Enhanced measurement.
  expect(inline[0]?.match(/gtag\('config'/g)).toEqual(["gtag('config'"]);
  expect(inline[0]).toContain("gtag('config','G-B6CYR6VF70')");
  expect(inline[0]).not.toContain("page_view");
});

test("loads nothing without IDs, as in development and tests", () => {
  expect(googleTagScripts({})).toEqual([]);
});

test("names the scripts a built page lacks", () => {
  const html = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-B6CYR6VF70"></script>`;
  expect(missingGoogleTagScripts(html)).toEqual(["AdSense"]);
  expect(missingGoogleTagScripts("<html></html>")).toEqual(["gtag.js", "AdSense"]);
});
