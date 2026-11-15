import { expect, test } from "vitest";
import { otherWorks, parseProfile, profileLinks } from "./profile.ts";

/** What https://links.bmth.dev/profile.json serves, cut down. */
const fixture = {
  version: 1,
  name: { ja: "じょうげん" },
  bio: { ja: "フルスタック趣味人" },
  url: "https://links.bmth.dev/",
  avatar: [
    {
      path: "/avatar-192.webp",
      width: 192,
      height: 192,
      type: "image/webp",
      url: "https://links.bmth.dev/avatar-192.webp",
    },
  ],
  sameAs: ["https://x.com/j_ktwr", "https://github.com/bmthd"],
  sections: [
    {
      id: "sns",
      heading: null,
      items: [
        { label: { ja: "X" }, url: "https://x.com/j_ktwr", me: true },
        { label: { ja: "GitHub" }, url: "https://github.com/bmthd", me: true },
        { label: { ja: "Zenn" }, url: "https://zenn.dev/bmth", me: true },
        { label: { ja: "Blog" }, url: "https://blog.bmth.dev/", me: true },
      ],
    },
    {
      id: "works",
      heading: { ja: "WORKS" },
      items: [
        {
          label: { ja: "コミケお品書きまとめ" },
          url: "https://oshinagaki.bmth.dev/",
          me: false,
        },
        {
          label: { ja: "楽天市場ポイント計算" },
          url: "https://point-sprint.bmth.dev/",
          me: false,
        },
      ],
    },
  ],
};

test("reads the name, bio and links of the profile", () => {
  const profile = parseProfile(fixture);
  expect(profile.name.ja).toBe("じょうげん");
  expect(profile.bio.ja).toBe("フルスタック趣味人");
  expect(profileLinks(profile).map((link) => link.label)).toEqual([
    "X",
    "GitHub",
    "Zenn",
    "Blog",
    "links.bmth.dev",
  ]);
});

test("leaves out this site from the works", () => {
  expect(otherWorks(parseProfile(fixture))).toEqual([
    { label: "コミケお品書きまとめ", url: "https://oshinagaki.bmth.dev/" },
  ]);
});

test("rejects a profile of another version", () => {
  expect(() => parseProfile({ ...fixture, version: 2 })).toThrow();
});
