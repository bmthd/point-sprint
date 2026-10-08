import { Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { Box } from "@workspaces/ui";
import { PageWithSidebar } from "../../layout/sidebar";
import { NoticeSection } from "../../features/notices/notice-section";

/**
 * The frame of the pages written in Markdown. A route that puts `surface: "paper"` in its context
 * (利用規約、プライバシーポリシー) is shown on white, like a sheet of paper; the others stay on the page's gray.
 */
export const Route = createFileRoute("/(markdown)")({
  component: MarkdownLayout,
});

function MarkdownLayout() {
  const paper = useChildMatches({
    select: (matches) =>
      matches.some((match) => "surface" in match.context && match.context.surface === "paper"),
  });
  return (
    <Box bg={paper ? "bg.panel" : undefined} h="full">
      <PageWithSidebar maxW="640px" sidebar={<NoticeSection />}>
        <Outlet />
      </PageWithSidebar>
    </Box>
  );
}
