import {
  type AnyRouter,
  type RegisteredRouter,
  type LinkComponentProps,
  createLink,
} from "@tanstack/react-router";
import { Button, type ButtonProps, IconButton, type IconButtonProps, Link } from "@workspaces/ui";

// `createLink` instead of `<Link as={TanStackLink}>`: through `as`, `to` and `search` lose the route's types.
const CreatedLink = createLink(Link);

/** Yamada UI's `Link` that navigates in the app, with the route's typed `to` and `search`. */
export function RouterLink<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = "",
>(props: LinkComponentProps<typeof CreatedLink, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) {
  return <CreatedLink {...props} />;
}

const CreatedButton = createLink((props: ButtonProps) => <Button as="a" {...props} />);

/** Yamada UI's `Button`, drawn as a link that navigates in the app, with the route's typed `to` and `search`. */
export function RouterButton<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = "",
>(props: LinkComponentProps<typeof CreatedButton, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) {
  return <CreatedButton {...props} />;
}

const CreatedIconButton = createLink((props: IconButtonProps) => <IconButton as="a" {...props} />);

/** Yamada UI's `IconButton`, drawn as a link that navigates in the app, with the route's typed `to` and `search`. */
export function RouterIconButton<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = "",
>(props: LinkComponentProps<typeof CreatedIconButton, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) {
  return <CreatedIconButton {...props} />;
}
