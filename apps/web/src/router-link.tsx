import { type LinkComponent, createLink } from "@tanstack/react-router";
import { Button, type ButtonProps, Link } from "@workspaces/ui";

// `createLink` instead of `<Link as={TanStackLink}>`: through `as`, `to` and `search` lose the route's types.
const CreatedLink = createLink(Link);

/** Yamada UI's `Link` that navigates in the app, with the route's typed `to` and `search`. */
export const RouterLink: LinkComponent<typeof CreatedLink> = (props) => <CreatedLink {...props} />;

const CreatedButton = createLink((props: ButtonProps) => <Button as="a" {...props} />);

/** Yamada UI's `Button`, drawn as a link that navigates in the app, with the route's typed `to` and `search`. */
export const RouterButton: LinkComponent<typeof CreatedButton> = (props) => (
  <CreatedButton {...props} />
);
