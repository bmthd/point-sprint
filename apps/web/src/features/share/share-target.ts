import { defaultTitle, siteName, siteUrl } from "../../page-head";

/** What a share posts: a line of text and the link under it. */
export type ShareTarget = { text: string; url: string };

/** The site itself, under its default title. */
export const siteShareTarget: ShareTarget = { text: defaultTitle, url: `${siteUrl}/` };

/**
 * A plan's figures. The plan lives on this device only, so the link is the site and the figures
 * go in the text. `rate` is "—" when nothing is bought yet, and is then left out.
 */
export function resultShareTarget(total: number, rate: string): ShareTarget {
  const points = `獲得予定 ${total.toLocaleString("ja-JP")}P`;
  const figures = rate === "—" ? points : `${points}・実質還元率 ${rate}%`;
  return { text: `${figures}（${siteName}で計算）`, url: `${siteUrl}/` };
}

/** The pages that post `target` on each service, opened as plain links. */
export function shareLinks({ text, url }: ShareTarget) {
  return [
    {
      service: "X",
      label: "X でシェア",
      href: `https://x.com/intent/post?${new URLSearchParams({ text, url })}`,
    },
    {
      service: "Facebook",
      label: "Facebook でシェア",
      href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    },
    {
      service: "LINE",
      label: "LINE で送る",
      href: `https://social-plugins.line.me/lineit/share?${new URLSearchParams({ url, text })}`,
    },
  ] as const;
}

/** What the copy button puts on the clipboard. */
export const shareMessage = ({ text, url }: ShareTarget) => `${text}\n${url}`;
