import { useEffect } from "react";
import { siteUrl } from "./site-url";

export const siteName = "ポイントスプリント";
/**
 * The top page's title, and the one shared on social media for the whole site. It leads with the
 * words people search for, as search results show the site's name on a line of its own.
 */
export const defaultTitle = `楽天お買い物マラソン ポイント計算ツール｜買いまわり・SPU・上限 | ${siteName}`;
export const defaultDescription =
  "お買い物マラソンの買いまわり・SPU・上限を、ショップごとの金額を入れるだけで計算。獲得予定のポイントと還元率、上限まであといくら買えるかがわかります。0と5のつく日などのキャンペーンにも対応。無料・登録不要。";

/** The title of a page other than the top: "プロフィール | ポイントスプリント". */
export function pageTitle(title: string) {
  return `${title} | ${siteName}`;
}

type PageHeadOptions = {
  /** Path of the page, as in `prerenderedPages`. */
  path: string;
  /** Name of the page. Left out on the top page, which uses the site's own title. */
  title?: string;
  description?: string;
  /** Keeps search engines away from a page that shows only what this device has saved. */
  noindex?: boolean;
  /**
   * The days an article was published and last changed (`YYYY-MM-DD`), the latter only once it
   * has been changed: its OGP type becomes `article`, and the sitemap takes the later day as the
   * page's last change.
   */
  article?: { published: string; updated?: string };
};

/**
 * The `head` of a route: its title, description, canonical URL and the per-page OGP tags. The
 * root route has the tags every page shares (the OGP image, favicon, manifest). A route's meta
 * replaces the root's one of the same `name` or `property`.
 */
export function pageHead({
  path,
  title,
  description = defaultDescription,
  noindex = false,
  article,
}: PageHeadOptions) {
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
            ...(article.updated === undefined
              ? []
              : [{ property: "article:modified_time", content: article.updated }]),
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

/**
 * Puts `title` in the tab once it is known on the client, for a page whose name the prerendered
 * HTML cannot hold (a plan, whose ID is in the query string and whose data is on this device).
 */
export function useClientTitle(title: string | undefined) {
  useEffect(() => {
    if (title !== undefined) document.title = pageTitle(title);
  }, [title]);
}
