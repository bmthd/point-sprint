import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Box } from "@workspaces/ui";

/** The frame of the shopping guides: a column as wide as the Markdown pages'. */
export const Route = createFileRoute("/guides")({
  component: () => (
    <Box as="main" maxW="640px" mx="auto" px="4" pt="4" pb="16">
      <Outlet />
    </Box>
  ),
});
