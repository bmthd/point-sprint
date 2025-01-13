import NextLink from "next/link";
import { type ComponentStyle, type LinkProps } from "@yamada-ui/react";

/** Linkコンポーネントの共通設定 */
export const Link: ComponentStyle<"Link", LinkProps> = {
  defaultProps: {
    as: NextLink,
  },
};
