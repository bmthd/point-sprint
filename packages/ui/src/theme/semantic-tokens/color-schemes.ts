import { defineSemanticTokens } from "@yamada-ui/react";

export const colorSchemes = defineSemanticTokens.colorSchemes({
  danger: "red",
  error: "red",
  info: "blue",
  link: "brand",
  mono: ["black", "white"],
  primary: "brand",
  secondary: "gray",
  success: "green",
  warning: "orange",
});
