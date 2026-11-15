import * as v from "valibot";
import { siteUrl } from "#/site-url.ts";

/** Where the operator's profile is kept: the link hub publishes it, so this site keeps no copy. */
export const profileUrl = "https://links.bmth.dev/profile.json";

const Japanese = v.object({ ja: v.string() });

/** The part of `profile.json` the about page shows. Another `version` changed what it means. */
export const Profile = v.object({
  version: v.literal(1),
  name: Japanese,
  bio: Japanese,
  url: v.pipe(v.string(), v.url()),
  avatar: v.pipe(
    v.array(
      v.object({
        url: v.pipe(v.string(), v.url()),
        width: v.number(),
        height: v.number(),
        type: v.string(),
      }),
    ),
    v.minLength(1),
  ),
  sameAs: v.array(v.pipe(v.string(), v.url())),
  sections: v.array(
    v.object({
      id: v.string(),
      items: v.array(
        v.object({ label: Japanese, url: v.pipe(v.string(), v.url()), me: v.boolean() }),
      ),
    }),
  ),
});
export type Profile = v.InferOutput<typeof Profile>;

type ProfileLink = { label: string; url: string };

/** Reads `profile.json`, throwing when it is not the shape this page knows. */
export function parseProfile(json: unknown): Profile {
  return v.parse(Profile, json);
}

const sectionLinks = (profile: Profile, id: string): ProfileLink[] =>
  (profile.sections.find((section) => section.id === id)?.items ?? []).map((item) => ({
    label: item.label.ja,
    url: item.url,
  }));

/** The operator's accounts, then the link hub itself. */
export function profileLinks(profile: Profile): ProfileLink[] {
  return [...sectionLinks(profile, "sns"), { label: "links.bmth.dev", url: profile.url }];
}

/** The operator's other works: this site is the page they are read on. */
export function otherWorks(profile: Profile): ProfileLink[] {
  const ownOrigin = new URL(siteUrl).origin;
  return sectionLinks(profile, "works").filter((work) => new URL(work.url).origin !== ownOrigin);
}
