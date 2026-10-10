import { Box, Grid } from "@workspaces/ui";
import type { ReactNode } from "react";
import { SiteSidebar } from "../-sidebar/sidebar";

/** The right column's width on a wide screen. */
const SIDEBAR_WIDTH = "320px";

/**
 * A page with the sidebar: on a wide screen the sidebar is a column to the right of `main`; at the
 * `lg` breakpoint and below (a phone or a tablet) it is in the header's menu instead. `maxW` is
 * the width of the page's own content, which stays the same with or without the sidebar.
 * `/notices`, which has the notices in full, leaves their headlines out with `noticeHeadlines`.
 */
export function PageWithSidebar({
  maxW,
  noticeHeadlines = true,
  children,
}: {
  maxW: string;
  noticeHeadlines?: boolean;
  children: ReactNode;
}) {
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
      <SiteSidebar noticeHeadlines={noticeHeadlines} display={{ base: "flex", lg: "none" }} />
    </Grid>
  );
}
