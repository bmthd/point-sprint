/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Box, ColorModeScript, UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import type { ReactNode } from "react";
import { AppProviders } from "../app-providers";
import { SiteFooter } from "../features/layout/site-footer";
import { SiteHeader } from "../features/layout/site-header";
import { GoogleTagScripts } from "../google-tags/google-tag-scripts";
import { defaultDescription, defaultTitle, siteName, siteUrl } from "../page-head";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Each route's `pageHead` replaces these and adds the per-page OGP tags.
      { title: defaultTitle },
      { name: "description", content: defaultDescription },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: defaultTitle },
      { property: "og:locale", content: "ja_JP" },
      { property: "og:image", content: `${siteUrl}/opengraph-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${siteName}の計算画面` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/icon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
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
      {/* The footer stays at the bottom of the screen on a short page. */}
      <Box bg="bg" color="fg" minH="100dvh" display="flex" flexDirection="column">
        <SiteHeader />
        <Box flex="1">
          <Outlet />
        </Box>
        <SiteFooter />
      </Box>
    </RootDocument>
  );
}

/** The browser's bar takes the color of the solid brand buttons: `brand.500`, and `brand.600` in dark. */
const themeColor = { light: "#bf0000", dark: "#a30000" };

/** The server has no device storage: reading `localStorage` there makes Node warn, so it reads nothing. */
const colorModeStorage = typeof window === "undefined" ? "cookie" : "localStorage";

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
        <GoogleTagScripts />
        {/* Both stay: the route head keeps only the last meta of a name. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={themeColor.light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={themeColor.dark} />
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
