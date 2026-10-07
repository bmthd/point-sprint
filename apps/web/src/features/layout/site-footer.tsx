import type { LinkProps } from "@tanstack/react-router";
import { Box, Text } from "@workspaces/ui";
import { RouterLink } from "../plan-list/router-link";

/**
 * The footer's links. Only pages that exist are listed: 使い方・注意事項, お知らせ and 利用規約
 * are added with their pages (#12).
 */
export const footerLinks: readonly { to: LinkProps["to"]; label: string }[] = [
  { to: "/inquiry", label: "お問い合わせ" },
];

/** The footer on every page: the links, and where the data is kept (it applies to every page). */
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
                key={link.to}
                to={link.to}
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
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          入力した内容はこのブラウザの中にだけ保存されます。ブラウザのデータを消すと、プランも消えます。
        </Text>
      </Box>
    </Box>
  );
}
