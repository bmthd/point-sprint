import type { LinkProps } from "@tanstack/react-router";
import { Box, Flex, Text } from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";

/** The footer's links. */
export const footerLinks: readonly { to: LinkProps["to"]; label: string }[] = [
  { to: "/notices", label: "お知らせ" },
  { to: "/help", label: "使い方・注意事項" },
  { to: "/calculation", label: "計算方法" },
  { to: "/terms", label: "利用規約" },
  { to: "/privacy", label: "プライバシーポリシー" },
  { to: "/inquiry", label: "お問い合わせ" },
];

/**
 * Rakuten Web Service's attribution, required on sites that use its API. The terms forbid changing
 * the HTML (comments included), so it is inserted as is. https://webservice.rakuten.co.jp/guide/credit
 */
const rakutenCredit = `<!-- Rakuten Web Services Attribution Snippet FROM HERE -->
<a href="https://webservice.rakuten.co.jp/" target="_blank"><img src="https://webservice.rakuten.co.jp/img/credit/200709/credit_31130.gif" border="0" alt="Rakuten Web Service Center" title="Rakuten Web Service Center" width="311" height="30"/></a>
<!-- Rakuten Web Services Attribution Snippet TO HERE -->`;

/**
 * The footer on every page: the links and where the data is kept (it applies to every page).
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
      <Flex maxW="1280px" mx="auto" px="4" py="6" direction="column" gap="2">
        {footerLinks.length > 0 ? (
          <Flex
            as="nav"
            aria-label="サイトの案内"
            justify="center"
            columnGap="4"
            wrap="wrap"
            fontSize="sm"
          >
            {footerLinks.map((link) => (
              <RouterLink
                key={link.label}
                to={link.to}
                color="link"
                minH="11"
                display="flex"
                alignItems="center"
              >
                {link.label}
              </RouterLink>
            ))}
          </Flex>
        ) : null}
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          入力した内容はこのブラウザの中に保存されます。ほかの端末と同期すると、運営者にも読めない暗号にしてから送ります。
        </Text>
        <Box
          display="flex"
          justifyContent="center"
          dangerouslySetInnerHTML={{ __html: rakutenCredit }}
        />
      </Flex>
    </Box>
  );
}
