import type { LinkProps } from "@tanstack/react-router";
import {
  Box,
  ChevronDownIcon,
  Drawer,
  Flex,
  IconButton,
  List,
  MenuIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Text,
  useColorMode,
  useDisclosure,
  useSystemColorMode,
  VStack,
} from "@workspaces/ui";
import type { ReactNode } from "react";
import { RouterLink } from "#/ui/router-link.tsx";
import { CloseIcon } from "#/ui/icons.tsx";
import { UnreadDot } from "#/routes/-notices/unread-dot.tsx";
import { useUnreadNoticeIds } from "#/routes/-notices/unread-notices.ts";
import { SiteSidebar } from "#/routes/-sidebar/sidebar.tsx";
import { SidebarSection } from "#/routes/-sidebar/sidebar-section.tsx";

type HeaderMenu = {
  to: LinkProps["to"];
  label: string;
  /** `fullLabel`: the label in サイトの案内, where the menu's name is not above it. */
  links: readonly { to: LinkProps["to"]; label: string; fullLabel?: string }[];
};

/** The pages a reader comes back to: the header's menus on a wide screen, サイトの案内 in the menu below it. */
const headerMenus: readonly HeaderMenu[] = [
  {
    to: "/marathon",
    label: "お買い物マラソン",
    links: [
      { to: "/marathon", label: "日程と上限", fullLabel: "お買い物マラソンの日程と上限" },
      { to: "/spu", label: "月ごとの SPU" },
    ],
  },
  {
    to: "/guides",
    label: "ガイド",
    links: [
      { to: "/guides", label: "買い物ガイド" },
      { to: "/help", label: "使い方" },
    ],
  },
];

/** `inMenu`: in the menu, its text starts on the line of the menu's other links. */
function CommonSettingsLink({ inMenu = false }: { inMenu?: boolean }) {
  return (
    <RouterLink
      to="/settings"
      minH="11"
      display="flex"
      alignItems="center"
      gap="1"
      px={inMenu ? "0" : "2"}
      color="fg"
      _current={{ fontWeight: "bold" }}
    >
      <SettingsIcon fontSize="xl" />
      <Text as="span" fontSize="sm">
        共通設定
      </Text>
    </RouterLink>
  );
}

/** A link of the header that spells its name, like `CommonSettingsLink`, with its `inMenu`. */
function HeaderTextLink({
  to,
  inMenu = false,
  children,
  ...rest
}: {
  to: "/guides" | "/notices";
  inMenu?: boolean;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <RouterLink
      to={to}
      {...rest}
      minH="11"
      display="flex"
      alignItems="center"
      px={inMenu ? "0" : "2"}
      fontSize="sm"
      color="fg"
      _current={{ fontWeight: "bold" }}
    >
      {children}
    </RouterLink>
  );
}

/** The link to `/notices`, with a dot while a notice there has not been read. */
function NoticesLink({ inMenu = false }: { inMenu?: boolean }) {
  const unread = useUnreadNoticeIds().size > 0;
  return (
    <HeaderTextLink
      to="/notices"
      inMenu={inMenu}
      aria-label={unread ? "お知らせ（未読あり）" : undefined}
    >
      <UnreadDot unread={unread} offset="-0.5">
        お知らせ
      </UnreadDot>
    </HeaderTextLink>
  );
}

/**
 * One of the header's menus on a wide screen. Its name goes to its main page; pointing at it, or
 * reaching it with the keyboard, opens its links below. It opens by CSS, before the page hydrates too.
 */
function HeaderMenuLinks({ menu }: { menu: HeaderMenu }) {
  return (
    <Box
      position="relative"
      css={{
        "&:hover > [data-header-menu], &:focus-within > [data-header-menu]": { display: "flex" },
      }}
    >
      <RouterLink
        to={menu.to}
        minH="11"
        display="flex"
        alignItems="center"
        gap="0.5"
        px="2"
        fontSize="sm"
        color="fg"
        _current={{ fontWeight: "bold" }}
      >
        {menu.label}
        <ChevronDownIcon aria-hidden fontSize="md" color="fg.muted" />
      </RouterLink>
      <VStack
        data-header-menu
        display="none"
        position="absolute"
        top="full"
        left="0"
        zIndex="kurillin"
        minW="44"
        gap="0"
        alignItems="stretch"
        py="1"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        rounded="l2"
        shadow="md"
      >
        {menu.links.map((link) => (
          <RouterLink
            key={link.label}
            to={link.to}
            // The menu's own page is in it too: only the link that says it is the current page.
            activeOptions={{ exact: true }}
            minH="11"
            display="flex"
            alignItems="center"
            px="3"
            fontSize="sm"
            color="fg"
            _hover={{ bg: "bg.muted", textDecoration: "none" }}
            _current={{ fontWeight: "bold" }}
          >
            {link.label}
          </RouterLink>
        ))}
      </VStack>
    </Box>
  );
}

/** サイトの案内, first in the sidebar of the menu: the links of the header's menus, one per line. */
function SiteGuideSection() {
  return (
    <SidebarSection title="サイトの案内">
      <List.Root gap="0">
        {headerMenus
          .flatMap((menu) => menu.links)
          .map((link) => (
            <List.Item key={link.label}>
              <RouterLink
                to={link.to}
                minH="11"
                display="flex"
                alignItems="center"
                fontSize="sm"
                color="fg"
                _current={{ fontWeight: "bold" }}
              >
                {link.fullLabel ?? link.label}
              </RouterLink>
            </List.Item>
          ))}
      </List.Root>
    </SidebarSection>
  );
}

const colorModeLabels = { light: "ライト", dark: "ダーク" } as const;

/**
 * Switches between light and dark. A choice the device already makes is not kept: the site goes
 * back to following the device. Only a choice against it is kept, as an override.
 */
function ColorModeButton() {
  const { colorMode, changeColorMode } = useColorMode();
  const { getSystemColorMode } = useSystemColorMode({ defaultColorMode: "light" });
  const next = colorMode === "light" ? "dark" : "light";

  return (
    <IconButton
      aria-label={`カラーモード（${colorModeLabels[colorMode]}）。${colorModeLabels[next]}に切り替える`}
      onClick={() => changeColorMode(next === getSystemColorMode() ? "system" : next)}
      size="lg"
      variant="ghost"
      color="fg"
      _hover={{ bg: "bg.muted" }}
      icon={colorMode === "light" ? <SunIcon /> : <MoonIcon />}
    />
  );
}

/**
 * The header on every page: the site name (to the top), the menus of the pages a reader comes back
 * to, お知らせ and 共通設定. The router marks the link
 * to the page being shown with `aria-current="page"`. The color mode switch is on every width, left of
 * the 共通設定 link or the menu. The 共通設定 link spells out its name: it moves to a page, unlike
 * the icon buttons that act in place. At the `lg` breakpoint and below the site name leaves no room
 * for it: the menu has it, with the sidebar.
 */
export function SiteHeader() {
  return (
    <Box as="header" borderBottomWidth="1px" borderColor="border">
      <Flex
        maxW="1280px"
        mx="auto"
        h="14"
        align="center"
        justify="space-between"
        gap="2"
        pl={{ base: "6", lg: "4" }}
        pr={{ base: "4", lg: "2" }}
      >
        <RouterLink
          to="/"
          // Every path starts with `/`: only the top itself is the current page.
          activeOptions={{ exact: true }}
          fontWeight="bold"
          fontSize="lg"
          color="fg"
          minH="11"
          display="flex"
          alignItems="center"
          _hover={{ textDecoration: "none" }}
        >
          ポイントスプリント
        </RouterLink>
        <Flex flex="1" align="center" gap="1" display={{ base: "flex", lg: "none" }}>
          {headerMenus.map((menu) => (
            <HeaderMenuLinks key={menu.label} menu={menu} />
          ))}
          <NoticesLink />
        </Flex>
        <Flex align="center" gap="1">
          <Box display={{ base: "none", lg: "contents" }}>
            <HeaderTextLink to="/guides">ガイド</HeaderTextLink>
          </Box>
          <ColorModeButton />
          <Box display={{ base: "contents", lg: "none" }}>
            <CommonSettingsLink />
          </Box>
          <SiteMenu />
        </Flex>
      </Flex>
    </Box>
  );
}

/**
 * The menu at the `lg` breakpoint and below: 共通設定 and お知らせ at the top, then the sidebar,
 * which starts with サイトの案内 (the header's menus on a wide screen). データを初期化 is on the
 * 共通設定 page, not here. Its button
 * has the dot of the お知らせ link too. It closes
 * on a link: one in the site moves to its page, one to a service opens in a new tab.
 */
function SiteMenu() {
  const { open, onOpen, onClose } = useDisclosure();
  const unread = useUnreadNoticeIds().size > 0;

  return (
    <>
      <UnreadDot unread={unread} offset="2.5" display={{ base: "none", lg: "inline-block" }}>
        <IconButton
          aria-label={unread ? "メニュー（未読のお知らせあり）" : "メニュー"}
          size="lg"
          variant="ghost"
          color="fg"
          _hover={{ bg: "bg.muted" }}
          icon={<MenuIcon />}
          onClick={onOpen}
        />
      </UnreadDot>
      <Drawer.Root
        open={open}
        onClose={onClose}
        placement="inline-end"
        withCloseButton={false}
        restoreFocus
      >
        <Drawer.Content bg="bg" roundedLeft="l2">
          <Drawer.Header justifyContent="space-between">
            <Drawer.Title as="h2">メニュー</Drawer.Title>
            <IconButton variant="ghost" aria-label="閉じる" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Drawer.Header>
          <Drawer.Body
            alignItems="stretch"
            gap="md"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a")) onClose();
            }}
          >
            <VStack gap="0" alignItems="stretch">
              <CommonSettingsLink inMenu />
              <NoticesLink inMenu />
            </VStack>
            <SiteSidebar inMenu>
              <SiteGuideSection />
            </SiteSidebar>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}
