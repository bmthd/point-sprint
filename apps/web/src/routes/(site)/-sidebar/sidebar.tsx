import { Box, Grid, VStack } from "@workspaces/ui";
import type { ReactNode } from "react";
import { NoticeSection } from "../-notices/notice-section";

/** The right column's width on a wide screen. */
const SIDEBAR_WIDTH = "320px";

/**
 * A page with the sidebar: on a wide screen the sidebar is a column to the right of `main`; at the
 * `lg` breakpoint and below (a phone or a tablet) it follows `main`, above the footer. `maxW` is
 * the width of the page's own content, which stays the same with or without the sidebar.
 */
export function PageWithSidebar({ maxW, children }: { maxW: string; children: ReactNode }) {
  return (
    <Grid
      gridTemplateColumns={{
        base: `minmax(0, ${maxW}) ${SIDEBAR_WIDTH}`,
        lg: `minmax(0, ${maxW})`,
      }}
      justifyContent="center"
      alignItems="start"
      columnGap="lg"
      rowGap="10"
      px="md"
      pt="md"
      pb="16"
    >
      <Box as="main" minW="0">
        {children}
      </Box>
      <SiteSidebar />
    </Grid>
  );
}

/**
 * The sections of the sidebar, top to bottom. Each one is a `SidebarSection` (or, for an ad slot,
 * a box of the same width): a new one is a line here. The share buttons (#11) go last, so they
 * close the right column on a wide screen and come right after the content on a phone.
 */
export function SiteSidebar() {
  return (
    <VStack as="aside" aria-label="サイドバー" gap="md" alignItems="stretch" minW="0">
      <NoticeSection />
    </VStack>
  );
}
