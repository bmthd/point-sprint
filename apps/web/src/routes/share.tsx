import { createFileRoute } from "@tanstack/react-router";
import {
  imageSize,
  resultFigures,
  resultImagePath,
  resultSearchSchema,
  resultSummary,
} from "./-share/result-card";
import { SharedResultPage } from "./-shared-result-page";
import { pageHead, siteUrl } from "../page-head";

/**
 * A shared result. Rendered by the Worker on each request, not ahead of time, so that its OGP tags
 * carry the figures in the query string and point at their image.
 */
export const Route = createFileRoute("/share")({
  validateSearch: resultSearchSchema,
  head: ({ match }) => {
    const figures = resultFigures(match.search);
    const head = pageHead({
      path: "/share",
      title: figures ? resultSummary(figures) : "シェアされた計算結果",
      noindex: true,
    });
    if (!figures) return head;
    return {
      ...head,
      meta: [
        ...head.meta,
        { property: "og:image", content: `${siteUrl}${resultImagePath(figures)}` },
        { property: "og:image:width", content: String(imageSize.width) },
        { property: "og:image:height", content: String(imageSize.height) },
        { property: "og:image:alt", content: resultSummary(figures) },
      ],
    };
  },
  component: function Share() {
    return <SharedResultPage figures={resultFigures(Route.useSearch())} />;
  },
});
