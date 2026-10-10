import { type StackProps, VStack } from "@workspaces/ui";
import { NoticeHeadlines } from "../-notices/notice-headlines";
import { ShareSection } from "./share-section";

/**
 * The sections of the sidebar, top to bottom. Each one is a `SidebarSection` (or, for an ad slot,
 * a box of the same width): a new one is a line here. Sharing the site goes last, so it closes
 * the sidebar. On a wide screen it is a column of the pages that read; at the `lg` breakpoint and
 * below it is in the header's menu, on every page.
 */
export function SiteSidebar({
  noticeHeadlines = true,
  ...rest
}: { noticeHeadlines?: boolean } & StackProps) {
  return (
    <VStack as="aside" aria-label="サイドバー" gap="md" alignItems="stretch" minW="0" {...rest}>
      {noticeHeadlines ? <NoticeHeadlines /> : null}
      <ShareSection />
    </VStack>
  );
}
