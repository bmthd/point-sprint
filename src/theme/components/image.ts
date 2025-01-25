import { ComponentStyle, ImageProps } from "@yamada-ui/react";
import NextImage from "next/image";

export const Image: ComponentStyle<"Image", ImageProps> = {
  defaultProps: {
    as: NextImage,
  },
};
