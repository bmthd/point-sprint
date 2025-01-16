import NextLink from "next/link";
import { ComponentProps } from "react";

declare module "@yamada-ui/react" {
  interface LinkProps extends ComponentProps<typeof NextLink> {}
}
