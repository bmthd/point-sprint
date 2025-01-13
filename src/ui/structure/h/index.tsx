"use client";
import { useLevel } from "@/ui/structure/context";
import { Heading } from "@yamada-ui/react";
import { ComponentProps, FC } from "react";

/**
 * 見出しコンポーネント
 */
export const H: FC<Omit<ComponentProps<typeof Heading>, "as">> = (props) => {
  const level = useLevel();
  switch (level) {
    case 1:
      return <Heading as="h1" {...props} />;
    case 2:
      return <Heading as="h2" {...props} />;
    case 3:
      return <Heading as="h3" {...props} />;
    case 4:
      return <Heading as="h4" {...props} />;
    case 5:
      return <Heading as="h5" {...props} />;
    case 6:
      return <Heading as="h6" {...props} />;
  }
};
