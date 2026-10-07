import { describe, expect, test } from "vitest";
import { resultShareTarget, shareLinks, shareMessage, siteShareTarget } from "./share-target";

const query = (href: string) => Object.fromEntries(new URL(href).searchParams);

describe("share targets", () => {
  test("the site is shared under its default title", () => {
    expect(siteShareTarget).toEqual({
      text: "ポイントスプリント 楽天市場お買い物マラソン攻略計算ツール",
      url: "https://point-sprint.bmth.dev/",
    });
  });

  test("a result puts the points and the rate in the text, and links to the site", () => {
    expect(resultShareTarget(2600, "6.5")).toEqual({
      text: "獲得予定 2,600P・実質還元率 6.5%（ポイントスプリントで計算）",
      url: "https://point-sprint.bmth.dev/",
    });
  });

  test("a result with nothing bought leaves the rate out", () => {
    expect(resultShareTarget(0, "—").text).toBe("獲得予定 0P（ポイントスプリントで計算）");
  });
});

describe("shareLinks", () => {
  const target = { text: "獲得予定 2,600P & 6.5%", url: "https://point-sprint.bmth.dev/" };
  const [x, facebook, line] = shareLinks(target);

  test("X posts the text and the link", () => {
    expect(x?.href.startsWith("https://x.com/intent/post?")).toBe(true);
    expect(query(x?.href ?? "")).toEqual(target);
  });

  test("Facebook shares the link", () => {
    expect(facebook?.href.startsWith("https://www.facebook.com/sharer/sharer.php?")).toBe(true);
    expect(query(facebook?.href ?? "")).toEqual({ u: target.url });
  });

  test("LINE sends the link and the text", () => {
    expect(line?.href.startsWith("https://social-plugins.line.me/lineit/share?")).toBe(true);
    expect(query(line?.href ?? "")).toEqual(target);
  });

  test("the text is encoded, so a symbol in it does not split the query", () => {
    expect(x?.href).not.toContain("& 6.5%");
  });
});

test("the copied message is the text and the link on the next line", () => {
  expect(shareMessage({ text: "獲得予定 2,600P", url: "https://point-sprint.bmth.dev/" })).toBe(
    "獲得予定 2,600P\nhttps://point-sprint.bmth.dev/",
  );
});
