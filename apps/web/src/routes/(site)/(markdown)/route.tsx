import { Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { useMemo } from "react";
import { GuideToc, guideSections } from "./-guide-toc";
import { PageWithSidebar } from "../-page-with-sidebar";

/**
 * The frame of the pages written in Markdown: each is on a card, but the list of the shopping
 * guides, whose guides are cards of their own. A shopping guide has its contents at the top of the
 * sidebar.
 */
export const Route = createFileRoute("/(site)/(markdown)")({
  component: MarkdownLayout,
});

function MarkdownLayout() {
  const isGuideList = useChildMatches({
    select: (matches) => matches.some((match) => match.routeId === "/(site)/(markdown)/guides/"),
  });
  const guideBody = useChildMatches({
    select: (matches) =>
      matches.find((match) => match.routeId === "/(site)/(markdown)/guides/$slug")?.loaderData
        ?.article.body,
  });
  const sections = useMemo(() => (guideBody ? guideSections(guideBody) : []), [guideBody]);
  return (
    <PageWithSidebar
      maxW="640px"
      card={!isGuideList}
      sidebarTop={sections.length > 0 ? <GuideToc sections={sections} markReading /> : undefined}
    >
      <Outlet />
    </PageWithSidebar>
  );
}
