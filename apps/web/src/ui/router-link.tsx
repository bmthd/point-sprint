import { createLink } from "@tanstack/react-router";
import { Button, type ButtonProps, IconButton, type IconButtonProps, Link } from "@workspaces/ui";

// `createLink` instead of `<Link as={TanStackLink}>`: through `as`, `to` and `search` lose the route's types.

/** Yamada UI's `Link` that navigates in the app, with the route's typed `to` and `search`. */
export const RouterLink = createLink(Link);

/** Yamada UI's `Button`, drawn as a link that navigates in the app, with the route's typed `to` and `search`. */
export const RouterButton = createLink((props: ButtonProps) => <Button as="a" {...props} />);

/** Yamada UI's `IconButton`, drawn as a link that navigates in the app, with the route's typed `to` and `search`. */
export const RouterIconButton = createLink((props: IconButtonProps) => (
  <IconButton as="a" {...props} />
));
