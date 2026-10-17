import { Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { PageWithSidebar } from "../-page-with-sidebar";

/**
 * The frame of the pages written in Markdown. A route that puts `surface: "paper"` in its context
 * (利用規約、プライバシーポリシー) has its text on white, like a sheet of paper; the others stay on the page's gray.
 */
export const Route = createFileRoute("/(site)/(markdown)")({
  component: MarkdownLayout,
});

function MarkdownLayout() {
  const paper = useChildMatches({
    select: (matches) =>
      matches.some((match) => "surface" in match.context && match.context.surface === "paper"),
  });
  return (
    <PageWithSidebar maxW="640px" paper={paper}>
      <Outlet />
    </PageWithSidebar>
  );
}
