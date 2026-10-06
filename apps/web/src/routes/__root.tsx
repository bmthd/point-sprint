/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { ColorModeScript, UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import type { ReactNode } from "react";
import { AppProviders } from "../app-providers";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ポイント計算" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

/** The server has no device storage: reading `localStorage` there makes Node warn, so it reads nothing. */
const colorModeStorage = typeof window === "undefined" ? "cookie" : "localStorage";

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ColorModeScript defaultValue={config.defaultColorMode} />
        <UIProvider theme={theme} config={config} storage={colorModeStorage}>
          <AppProviders>{children}</AppProviders>
        </UIProvider>
        <Scripts />
      </body>
    </html>
  );
}
