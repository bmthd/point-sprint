import { defineStyles, visuallyHiddenAttributes } from "@yamada-ui/react";

export const layerStyles = defineStyles.layerStyle({
  active: { opacity: 1 },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.4,
    _ripple: { display: "none" },
  },
  ghost: {
    bg: "transparent",
    border: "1px solid transparent",
    color: "colorScheme.outline",
  },
  "ghost.hover": {
    bg: "colorScheme.ghost",
  },
  hover: { opacity: 0.8 },
  outline: {
    bg: "transparent",
    border: "1px solid {colorScheme.muted}",
    color: "colorScheme.outline",
  },
  "outline.hover": {
    bg: "colorScheme.ghost",
  },
  // A surface one step above the page: in light, a white face lifted by a faint shadow instead of a
  // line; in dark, a lighter face with a line, where a shadow would not show. The border stays,
  // transparent in light, so a panel is as big in both modes.
  panel: {
    bg: "bg.panel",
    borderColor: "transparent",
    borderWidth: "1px",
    boxShadow:
      "0 0 0 1px rgb(15 23 42 / 0.05), 0 1px 2px rgb(15 23 42 / 0.06), 0 4px 12px rgb(15 23 42 / 0.04)",
    rounded: "l4",
    _dark: { borderColor: "border", boxShadow: "none" },
  },
  readOnly: {
    cursor: "default",
    _ripple: { display: "none" },
  },
  solid: {
    bg: "colorScheme.solid",
    borderColor: "transparent",
    color: "colorScheme.contrast",
  },
  "solid.hover": {
    bg: "colorScheme.solid/80",
  },
  subtle: {
    bg: "colorScheme.subtle",
    borderColor: "transparent",
    color: "colorScheme.fg",
  },
  "subtle.hover": {
    bg: "colorScheme.muted",
  },
  surface: {
    bg: "colorScheme.subtle",
    border: "1px solid {colorScheme.muted}",
    color: "colorScheme.fg",
  },
  "surface.hover": {
    bg: "colorScheme.muted",
  },
  visuallyHidden: visuallyHiddenAttributes.style,
});
