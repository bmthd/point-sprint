import {
  Box,
  Drawer,
  Flex,
  IconButton,
  MenuIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Text,
  useColorMode,
  useDisclosure,
  useSystemColorMode,
} from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";
import { CloseIcon } from "../../ui/icons";
import { ResetDataButton } from "../-reset-data";
import { SiteSidebar } from "../-sidebar/sidebar";

function CommonSettingsLink() {
  return (
    <RouterLink
      to="/settings"
      minH="11"
      display="flex"
      alignItems="center"
      gap="1"
      px="2"
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

/** A link of the header that spells its name, like `CommonSettingsLink`. */
function HeaderTextLink({ to, children }: { to: "/guides" | "/help"; children: string }) {
  return (
    <RouterLink
      to={to}
      minH="11"
      display="flex"
      alignItems="center"
      px="2"
      fontSize="sm"
      color="fg"
      _current={{ fontWeight: "bold" }}
    >
      {children}
    </RouterLink>
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
 * The header on every page: the site name (to the top) and 共通設定. The router marks the link
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
          <HeaderTextLink to="/guides">買い物ガイド</HeaderTextLink>
          <HeaderTextLink to="/help">ヘルプ</HeaderTextLink>
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
 * The menu at the `lg` breakpoint and below: 共通設定 and the sidebar. It closes
 * on a link: one in the site moves to its page, one to a service opens in a new tab.
 */
function SiteMenu() {
  const { open, onOpen, onClose } = useDisclosure();

  return (
    <>
      <IconButton
        aria-label="メニュー"
        display={{ base: "none", lg: "inline-flex" }}
        size="lg"
        variant="ghost"
        color="fg"
        _hover={{ bg: "bg.muted" }}
        icon={<MenuIcon />}
        onClick={onOpen}
      />
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
            <CommonSettingsLink />
            <HeaderTextLink to="/help">ヘルプ</HeaderTextLink>
            <SiteSidebar />
            <ResetDataButton onDone={onClose} />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}
