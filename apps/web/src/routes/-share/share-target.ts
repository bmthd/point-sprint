import { defaultTitle, siteName, siteUrl } from "../../page-head";
import { type ResultFigures, resultPageUrl, resultSummary } from "./result-card";

/** What a share posts: a line of text and the link under it. */
export type ShareTarget = { text: string; url: string };

/** The site itself, under its default title. */
export const siteShareTarget: ShareTarget = { text: defaultTitle, url: `${siteUrl}/` };

/**
 * A plan's figures. The plan lives on this device only, so the figures go in the text and in the
 * link, whose page shows them as its OGP image.
 */
export function resultShareTarget(figures: ResultFigures): ShareTarget {
  return { text: `${resultSummary(figures)}（${siteName}で計算）`, url: resultPageUrl(figures) };
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
