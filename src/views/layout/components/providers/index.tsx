"use client";
import theme from "@/theme";
import { ColorModeScript, UIProvider } from "@yamada-ui/react";
import { FC, ReactNode } from "react";
import "./validation"

export const Providers: FC<{ children: ReactNode }> = ({ children }) => (
  <UIProvider theme={theme}>
    <ColorModeScript />
    {children}
  </UIProvider>
);
