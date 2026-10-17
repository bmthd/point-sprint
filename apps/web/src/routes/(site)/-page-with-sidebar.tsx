import { Box, Grid } from "@workspaces/ui";
import type { ReactNode } from "react";
import { SiteSidebar } from "../-sidebar/sidebar";

/** The right column's width on a wide screen. */
const SIDEBAR_WIDTH = "320px";
/** The left column's width, the widest `maxW`: the same on every page, so neither column moves. */
const MAIN_WIDTH = "768px";

/**
 * A page with the sidebar: on a wide screen the sidebar is a column to the right of `main`; at the
 * `lg` breakpoint and below (a phone or a tablet) it is in the header's menu instead. The columns
 * are as wide on every page; `maxW` is the width of the page's own content, from the left of its
 * column, which stays the same with or without the sidebar. The sidebar stays on the screen as
 * the page scrolls. `/notices`, which has the notices in full, leaves their headlines out with
 * `noticeHeadlines`.
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
        base: `minmax(0, ${MAIN_WIDTH}) ${SIDEBAR_WIDTH}`,
        lg: `minmax(0, ${MAIN_WIDTH})`,
      }}
      justifyContent="center"
      alignItems="start"
      columnGap="lg"
      rowGap="10"
      px="md"
      pt="md"
      pb="16"
    >
      <Box as="main" minW="0" maxW={maxW}>
        {children}
      </Box>
      {/* It follows the scroll, so a long page has no empty column beside it. */}
      <SiteSidebar
        noticeHeadlines={noticeHeadlines}
        display={{ base: "flex", lg: "none" }}
        position="sticky"
        top="md"
      />
    </Grid>
  );
}
