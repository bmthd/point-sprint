import { useEffect } from "react";
import { siteUrl } from "./site-url";

export { siteUrl };

export const siteName = "ポイントスプリント";
/** The top page's title, and the one shared on social media for the whole site. */
export const defaultTitle = `${siteName} 楽天市場お買い物マラソン攻略計算ツール`;
export const defaultDescription =
  "楽天市場のお買い物マラソンに特化した計算ツール。厳密な還元率、獲得上限に対応。あなたのポイ活を応援します。";

/** The title of a page other than the top: "プロフィール | ポイントスプリント". */
export const pageTitle = (title: string) => `${title} | ${siteName}`;

type PageHeadOptions = {
  /** Path of the page, as in `prerenderedPages`. */
  path: string;
  /** Name of the page. Left out on the top page, which uses the site's own title. */
  title?: string;
  description?: string;
  /** Keeps search engines away from a page that shows only what this device has saved. */
  noindex?: boolean;
  /**
   * The days an article was published and last changed (`YYYY-MM-DD`): its OGP type becomes
   * `article`, and the sitemap takes the second as the page's last change.
   */
  article?: { published: string; updated: string };
};

/**
 * The `head` of a route: its title, description, canonical URL and the per-page OGP tags. The
 * root route has the tags every page shares (the OGP image, favicon, manifest). A route's meta
 * replaces the root's one of the same `name` or `property`.
 */
export const pageHead = ({
  path,
  title,
  description = defaultDescription,
  noindex = false,
  article,
}: PageHeadOptions) => {
  const fullTitle = title === undefined ? defaultTitle : pageTitle(title);
  const url = `${siteUrl}${path}`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
      ...(article
        ? [
            { property: "og:type", content: "article" },
            { property: "article:published_time", content: article.published },
            { property: "article:modified_time", content: article.updated },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
};

/**
 * Puts `title` in the tab once it is known on the client, for a page whose name the prerendered
 * HTML cannot hold (a plan, whose ID is in the query string and whose data is on this device).
 */
export function useClientTitle(title: string | undefined) {
  useEffect(() => {
    if (title !== undefined) document.title = pageTitle(title);
  }, [title]);
}
