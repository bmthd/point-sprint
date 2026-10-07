import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Box, Card } from "@workspaces/ui";

/** The frame of the pages written in Markdown: the text on a panel like the other pages' cards. */
export const Route = createFileRoute("/(markdown)")({
  component: MarkdownLayout,
});

function MarkdownLayout() {
  return (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <Card.Root as="article">
        <Card.Body display="block">
          <Outlet />
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
