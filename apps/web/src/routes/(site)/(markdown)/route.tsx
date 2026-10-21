import { Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { useMemo } from "react";
import { GuideToc, guideSections } from "./-guide-toc";
import { PageWithSidebar } from "../-page-with-sidebar";

/**
 * The frame of the pages written in Markdown. A route that puts `surface: "paper"` in its context
 * (利用規約、プライバシーポリシー) has its text on white, like a sheet of paper; the others stay on the page's gray.
 * A shopping guide has its contents at the top of the sidebar.
 */
export const Route = createFileRoute("/(site)/(markdown)")({
  component: MarkdownLayout,
});

function MarkdownLayout() {
  const paper = useChildMatches({
    select: (matches) =>
      matches.some((match) => "surface" in match.context && match.context.surface === "paper"),
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
      paper={paper}
      sidebarTop={sections.length > 0 ? <GuideToc sections={sections} markReading /> : undefined}
    >
      <Outlet />
    </PageWithSidebar>
  );
}
