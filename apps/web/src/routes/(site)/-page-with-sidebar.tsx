import { Box, Card, Grid } from "@workspaces/ui";
import type { ReactNode } from "react";
import { SiteSidebar } from "../-sidebar/sidebar";
import { COLUMN_HEAD_HEIGHT } from "../../ui/column-head";

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
 * `noticeHeadlines`. `sidebarTop` goes at the top of the sidebar, above its own sections. With
 * `card`, `main` is a card, as a page of reading is; beside the sidebar it starts on the line of
 * the sidebar's first card, under the row its heading takes.
 */
export function PageWithSidebar({
  maxW,
  noticeHeadlines = true,
  card = false,
  sidebarTop,
  children,
}: {
  maxW: string;
  noticeHeadlines?: boolean;
  card?: boolean;
  sidebarTop?: ReactNode;
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
      {card ? (
        <Card.Root
          as="main"
          minW="0"
          // As wide as the text and its padding on both sides, so the text stays `maxW` wide.
          maxW={{ base: `calc(${maxW} + {spaces.16})`, md: maxW }}
          mt={{ base: `calc(${COLUMN_HEAD_HEIGHT} + {spaces.2.5})`, lg: "0" }}
        >
          <Card.Body display="block" px={{ base: "8", md: "4" }} pt="6" pb="10">
            {children}
          </Card.Body>
        </Card.Root>
      ) : (
        <Box as="main" minW="0" maxW={maxW}>
          {children}
        </Box>
      )}
      {/* It follows the scroll, so a long page has no empty column beside it. */}
      <SiteSidebar
        noticeHeadlines={noticeHeadlines}
        display={{ base: "flex", lg: "none" }}
        position="sticky"
        top="md"
      >
        {sidebarTop}
      </SiteSidebar>
    </Grid>
  );
}
