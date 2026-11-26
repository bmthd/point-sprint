import type { LinkProps } from "@tanstack/react-router";
import { Box, Flex, Link, Text, VStack, Wrap } from "@workspaces/ui";
import { operatorName } from "#/page-head.ts";
import { RouterLink } from "#/ui/router-link.tsx";

type FooterLink =
  | { to: LinkProps["to"]; params?: LinkProps["params"]; label: string }
  | { href: string; label: string };

/**
 * The footer's links: who makes the site and its rules. The pages a reader comes back to are in the
 * header instead.
 */
const footerLinks: readonly FooterLink[] = [
  { to: "/about", label: "このサイトについて" },
  { to: "/guides/$slug", params: { slug: "why-point-sprint" }, label: "なぜポイントスプリントか" },
  { href: "https://github.com/bmthd/point-sprint", label: "ソースコード" },
  { to: "/inquiry", label: "お問い合わせ" },
  { to: "/terms", label: "利用規約" },
  { to: "/privacy", label: "プライバシーポリシー" },
];

/**
 * Rakuten Web Service's attribution, required on sites that use its API. The terms forbid changing
 * the HTML (comments included), so it is inserted as is. https://webservice.rakuten.co.jp/guide/credit
 */
const rakutenCredit = `<!-- Rakuten Web Services Attribution Snippet FROM HERE -->
<a href="https://webservice.rakuten.co.jp/" target="_blank"><img src="https://webservice.rakuten.co.jp/img/credit/200709/credit_31130.gif" border="0" alt="Rakuten Web Service Center" title="Rakuten Web Service Center" width="311" height="30"/></a>
<!-- Rakuten Web Services Attribution Snippet TO HERE -->`;

/**
 * The footer on every page: the links about the site, where the data is kept (it applies to every
 * page) and who makes the site.
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
      <Flex maxW="1280px" mx="auto" px="4" py="6" direction="column" gap="md">
        <Wrap
          as="nav"
          aria-label="サイトの情報"
          justifyContent="center"
          columnGap="lg"
          fontSize="sm"
        >
          {footerLinks.map((link) =>
            "to" in link ? (
              <RouterLink
                key={link.label}
                to={link.to}
                params={link.params}
                color="link"
                minH="11"
                display="flex"
                alignItems="center"
              >
                {link.label}
              </RouterLink>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener"
                color="link"
                minH="11"
                display="flex"
                alignItems="center"
              >
                {link.label}
              </Link>
            ),
          )}
        </Wrap>
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          入力した内容はこのブラウザの中に保存されます。ほかの端末と同期すると、運営者にも読めない暗号にしてから送ります。
        </Text>
        <VStack gap="0" fontSize="xs" color="fg.muted" textAlign="center">
          <Text>ポイントスプリントは個人開発のサイトです。</Text>
          <Text>© 2026 {operatorName}</Text>
        </VStack>
        <Box
          display="flex"
          justifyContent="center"
          dangerouslySetInnerHTML={{ __html: rakutenCredit }}
        />
      </Flex>
    </Box>
  );
}
