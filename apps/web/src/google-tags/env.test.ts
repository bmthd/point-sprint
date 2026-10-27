import { expect, test } from "vitest";
import { parseGoogleTagsEnv } from "./env";

test("reads the measurement and AdSense client IDs", () => {
  expect(
    parseGoogleTagsEnv({
      PUBLIC_GA_MEASUREMENT_ID: "G-B6CYR6VF70",
      PUBLIC_ADSENSE_CLIENT_ID: "ca-pub-8953986206743618",
    }),
  ).toEqual({ measurementId: "G-B6CYR6VF70", adsenseClientId: "ca-pub-8953986206743618" });
});

test("rejects a missing ID", () => {
  expect(() => parseGoogleTagsEnv({ PUBLIC_GA_MEASUREMENT_ID: "G-B6CYR6VF70" })).toThrow(
    /PUBLIC_ADSENSE_CLIENT_ID/,
  );
});

test("rejects a value dotenvx left encrypted", () => {
  expect(() =>
    parseGoogleTagsEnv({
      PUBLIC_GA_MEASUREMENT_ID: "encrypted:BCx0AbC",
      PUBLIC_ADSENSE_CLIENT_ID: "ca-pub-8953986206743618",
    }),
  ).toThrow(/PUBLIC_GA_MEASUREMENT_ID/);
});
