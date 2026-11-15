import type { LinkProps } from "@tanstack/react-router";
import { Box, Flex, Grid, Heading, Link, Text, VStack } from "@workspaces/ui";
import { operatorName } from "#/page-head.ts";
import { RouterLink } from "#/ui/router-link.tsx";

type FooterLink = { to: LinkProps["to"]; label: string } | { href: string; label: string };

/** The footer's links, in groups by what a reader comes for. */
export const footerGroups: readonly { heading: string; links: readonly FooterLink[] }[] = [
  {
    heading: "使う",
    links: [
      { to: "/marathon", label: "マラソンの日程と上限" },
      { to: "/spu", label: "SPU" },
    ],
  },
  {
    heading: "読む",
    links: [
      { to: "/guides", label: "買い物ガイド" },
      { to: "/notices", label: "お知らせ" },
      { to: "/help", label: "使い方" },
    ],
  },
  {
    heading: "このサイトについて",
    links: [
      { to: "/about", label: "運営者" },
      { href: "https://github.com/bmthd/point-sprint", label: "ソースコード" },
      { to: "/inquiry", label: "お問い合わせ" },
    ],
  },
  {
    heading: "決まりごと",
    links: [
      { to: "/terms", label: "利用規約" },
      { to: "/privacy", label: "プライバシーポリシー" },
    ],
  },
];

/**
 * Rakuten Web Service's attribution, required on sites that use its API. The terms forbid changing
 * the HTML (comments included), so it is inserted as is. https://webservice.rakuten.co.jp/guide/credit
 */
const rakutenCredit = `<!-- Rakuten Web Services Attribution Snippet FROM HERE -->
<a href="https://webservice.rakuten.co.jp/" target="_blank"><img src="https://webservice.rakuten.co.jp/img/credit/200709/credit_31130.gif" border="0" alt="Rakuten Web Service Center" title="Rakuten Web Service Center" width="311" height="30"/></a>
<!-- Rakuten Web Services Attribution Snippet TO HERE -->`;

/**
 * The footer on every page: the links in their groups, where the data is kept (it applies to every
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
        <Grid
          as="nav"
          aria-label="サイトの案内"
          templateColumns={{ base: "repeat(4, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))" }}
          gap="md"
          maxW="960px"
          w="full"
          mx="auto"
          fontSize="sm"
        >
          {footerGroups.map((group) => (
            <VStack key={group.heading} as="section" gap="0" alignItems="start">
              <Heading as="h2" fontSize="xs" color="fg.muted" mb="1">
                {group.heading}
              </Heading>
              {group.links.map((link) =>
                "to" in link ? (
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
            </VStack>
          ))}
        </Grid>
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
