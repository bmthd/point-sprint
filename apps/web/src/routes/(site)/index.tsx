import { createFileRoute } from "@tanstack/react-router";
import { PlanList } from "./-plan-list/plan-list";
import { pageHead, siteName } from "../../page-head";
import { siteUrl } from "../../site-url";

export const Route = createFileRoute("/(site)/")({
  head: () => ({
    ...pageHead({ path: "/" }),
    // The name search results show for the site. Google reads it from the top page only.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteName,
          url: `${siteUrl}/`,
        }),
      },
    ],
  }),
  component: PlanList,
});
