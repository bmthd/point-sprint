import type { LinkProps } from "@tanstack/react-router";
import { Box, Text } from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";
import { ShareButton } from "../-share/share-button";
import { siteShareTarget } from "../-share/share-target";

/**
 * The footer's links. お知らせ is in the sidebar, and every page links to the one on the top page,
 * which always has it.
 */
export const footerLinks: readonly { to: LinkProps["to"]; hash?: string; label: string }[] = [
  { to: "/", hash: "notices", label: "お知らせ" },
  { to: "/help", label: "使い方・注意事項" },
  { to: "/terms", label: "利用規約" },
  { to: "/privacy", label: "プライバシーポリシー" },
  { to: "/inquiry", label: "お問い合わせ" },
];

/**
 * The footer on every page: the links, sharing the site, and where the data is kept (it applies to
 * every page).
 */
export function SiteFooter() {
  return (
    <Box
      as="footer"
      borderTopWidth="1px"
      borderColor="border"
      // A bar fixed to the bottom of the screen (`data-bottom-bar`) would hide the footer.
      css={{
        "body:has([data-bottom-bar]) &": { pb: "calc(8rem + env(safe-area-inset-bottom))" },
      }}
    >
      <Box maxW="1280px" mx="auto" px="4" py="6" display="flex" flexDirection="column" gap="2">
        {footerLinks.length > 0 ? (
          <Box
            as="nav"
            aria-label="サイトの案内"
            display="flex"
            justifyContent="center"
            columnGap="4"
            flexWrap="wrap"
            fontSize="sm"
          >
            {footerLinks.map((link) => (
              <RouterLink
                key={link.label}
                to={link.to}
                hash={link.hash}
                // `/` would otherwise match every page: お知らせ is current only at `/#notices`.
                activeOptions={{ exact: true, includeHash: true }}
                color="link"
                minH="11"
                display="flex"
                alignItems="center"
              >
                {link.label}
              </RouterLink>
            ))}
          </Box>
        ) : null}
        <ShareButton
          iconOnly
          label="このサイトをシェア"
          target={siteShareTarget}
          alignSelf="center"
        />
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          入力した内容はこのブラウザの中にだけ保存されます。ブラウザのデータを消すと、プランも消えます。
        </Text>
      </Box>
    </Box>
  );
}
