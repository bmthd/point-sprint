import { type StackProps, VStack } from "@workspaces/ui";
import { RecentArticles } from "./recent-articles.tsx";
import { ShareSection } from "./share-section.tsx";
import { SidebarPlacement } from "./sidebar-section.tsx";

/**
 * The sections of the sidebar, top to bottom. Each one is a `SidebarSection` (or, for an ad slot,
 * a box of the same width): a new one is a line here. Sharing the site goes last, so it closes
 * the sidebar. A page's own section (`children`) goes first. On a wide screen it is a column of
 * the pages that read; at the `lg` breakpoint and below it is in the header's menu (`inMenu`), on
 * every page, with lines between its sections instead of cards.
 */
export function SiteSidebar({
  inMenu = false,
  children,
  ...rest
}: StackProps & { inMenu?: boolean }) {
  return (
    <SidebarPlacement value={inMenu ? "menu" : "column"}>
      <VStack as="aside" aria-label="サイドバー" gap="md" alignItems="stretch" minW="0" {...rest}>
        {children}
        <RecentArticles />
        <ShareSection />
      </VStack>
    </SidebarPlacement>
  );
}
