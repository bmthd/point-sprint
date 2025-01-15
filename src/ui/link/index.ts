import { Link } from "@yamada-ui/react";
import { ComponentProps } from "react";

export type LinkItem = {
  label: string;
} & ComponentProps<typeof Link>;
