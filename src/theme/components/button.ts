import { type ComponentStyle } from "@yamada-ui/react";

export const Button: ComponentStyle<"Button", ButtonProps> = {
  defaultProps: {
    colorScheme: "primary",
    type: "button",
  },
};
