import { createServerFn } from "@tanstack/react-start";
import { parseProfile, profileUrl } from "./profile.ts";

/**
 * The operator's profile, read from the link hub. The about page is prerendered, so the build
 * reads it: a profile it cannot read stops the build rather than leaving the page without it.
 */
export const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  const response = await fetch(profileUrl);
  if (!response.ok) throw new Error(`${profileUrl} returned ${response.status}`);
  return parseProfile(await response.json());
});
