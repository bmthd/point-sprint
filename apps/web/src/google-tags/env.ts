import * as v from "valibot";

/** The public IDs of Google Analytics and AdSense, which the production build puts in every page. */
const GoogleTagsEnvSchema = v.object({
  PUBLIC_GA_MEASUREMENT_ID: v.pipe(
    v.string(),
    v.regex(/^G-[A-Z0-9]+$/, "must look like G-XXXXXXXXXX"),
  ),
  PUBLIC_ADSENSE_CLIENT_ID: v.pipe(
    v.string(),
    v.regex(/^ca-pub-\d{16}$/, "must look like ca-pub-0000000000000000"),
  ),
});

export type GoogleTagIds = { measurementId?: string; adsenseClientId?: string };

/** Throws with the names of the variables that are missing or malformed, e.g. still encrypted by dotenvx. */
export function parseGoogleTagsEnv(
  env: Record<string, string | undefined>,
): Required<GoogleTagIds> {
  const result = v.safeParse(GoogleTagsEnvSchema, env);
  if (!result.success) {
    const problems = result.issues.map(
      (issue) => `${v.getDotPath(issue) ?? "env"}: ${issue.message}`,
    );
    throw new Error(`Invalid Google tag environment variables:\n${problems.join("\n")}`);
  }
  return {
    measurementId: result.output.PUBLIC_GA_MEASUREMENT_ID,
    adsenseClientId: result.output.PUBLIC_ADSENSE_CLIENT_ID,
  };
}
