import { type LinkProps, Link, useLocation } from "@tanstack/react-router";
import {
  BellIcon,
  Center,
  Image,
  LinkIcon,
  SettingsIcon,
  Sidebar,
  Text,
  VStack,
  useClipboard,
} from "@workspaces/ui";
import type { ComponentProps } from "react";
import { japaneseDate } from "#/guides/article.ts";
import { UnreadDot } from "#/routes/-notices/unread-dot.tsx";
import { useUnreadNoticeIds } from "#/routes/-notices/unread-notices.ts";
import { serviceLogos } from "#/routes/-share/share-button.tsx";
import { shareLinks, shareMessage, siteShareTarget } from "#/routes/-share/share-target.ts";
import { useRecentArticles } from "#/routes/-sidebar/recent-articles.tsx";

/** An item's link in the app: its `value`, which the sidebar gives as `href`, is the path. */
function SidebarRouterLink({ href = "/", ...rest }: ComponentProps<"a">) {
  return <Link to={href as LinkProps["to"]} {...rest} />;
}

/**
 * The header's menu below the `lg` breakpoint, in Yamada UI's `Sidebar`: 共通設定 and お知らせ at
 * the top, then サイトの案内 (`guideLinks`, the header's menus on a wide screen), the guides
 * changed most recently and sharing the site. The page being shown is the selected item. The
 * items are 44px high, to be tapped, and a line is above each group.
 */
export function MenuSidebar({
  guideLinks,
}: {
  guideLinks: readonly { to: LinkProps["to"]; label: string; fullLabel?: string }[];
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const unread = useUnreadNoticeIds().size > 0;
  const articles = useRecentArticles();
  const { copied, onCopy } = useClipboard();

  return (
    <Sidebar.Root
      breakpoint={false}
      selectedValue={pathname}
      flexDirection="column"
      minH="0"
      css={{ "--side-panel-item-size": "sizes.11", "--side-panel-expanded-width": "100%" }}
    >
      <Sidebar.SidePanel
        aria-label="サイドバー"
        position="static"
        h="auto"
        withHandle={false}
        // A line above each group parts it from what is before it.
        groupProps={{ borderTopWidth: "1px", borderColor: "border", mt: "2", pt: "3" }}
        linkProps={{ as: SidebarRouterLink }}
      >
        <Sidebar.Content px="0">
          <Sidebar.Item label="共通設定" value="/settings" startElement={<SettingsIcon />} />
          <Sidebar.Item
            label="お知らせ"
            value="/notices"
            // The dot is on the bell, outside the label, which cuts off what is outside its line.
            startElement={
              <UnreadDot unread={unread} offset="0.5" lineHeight="1">
                <BellIcon />
              </UnreadDot>
            }
            linkProps={{
              "aria-label": unread ? "お知らせ（未読あり）" : "お知らせ",
              overflow: "visible",
            }}
          />
          <Sidebar.Group role="group" aria-label="サイトの案内" label="サイトの案内">
            {guideLinks.map((link) => (
              <Sidebar.Item
                key={link.label}
                label={link.fullLabel ?? link.label}
                value={link.to ?? "/"}
              />
            ))}
          </Sidebar.Group>
          {articles.length > 0 ? (
            <Sidebar.Group role="group" aria-label="最近更新された記事" label="最近更新された記事">
              {articles.map((article) => (
                <Sidebar.Item
                  key={article.slug}
                  value={`/guides/${article.slug}`}
                  // A title takes two lines when it is long: the item grows with it.
                  linkProps={{ h: "auto", minH: "11", py: "2", lineHeight: "short" }}
                  labelProps={{ whiteSpace: "normal" }}
                  label={
                    <VStack as="span" gap="0.5" alignItems="start">
                      <Text as="time" dateTime={article.date} fontSize="xs" color="fg.muted">
                        {japaneseDate(article.date)}
                      </Text>
                      <Text as="span">{article.title}</Text>
                    </VStack>
                  }
                />
              ))}
            </Sidebar.Group>
          ) : null}
          <Sidebar.Group role="group" aria-label="このサイトをシェア" label="このサイトをシェア">
            {shareLinks(siteShareTarget).map((link) => (
              <Sidebar.Item
                key={link.service}
                label={link.label}
                value={link.href}
                external
                linkProps={{ as: "a" }}
                startElement={
                  <Image src={serviceLogos[link.service]} alt="" boxSize="5" rounded="xs" />
                }
              />
            ))}
            <Sidebar.MenuButton onClick={() => onCopy(shareMessage(siteShareTarget))}>
              <Center boxSize="5" rounded="xs" bg="bg.muted" color="fg">
                <LinkIcon fontSize="sm" />
              </Center>
              リンクをコピーする
            </Sidebar.MenuButton>
            <Text role="status" px="2" fontSize="sm" color="fg.muted" _empty={{ display: "none" }}>
              {copied ? "リンクをコピーしました" : ""}
            </Text>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar.SidePanel>
    </Sidebar.Root>
  );
}
