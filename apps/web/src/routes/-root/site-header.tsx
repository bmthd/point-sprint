import {
  Box,
  Drawer,
  Flex,
  IconButton,
  MenuIcon,
  MoonIcon,
  SunIcon,
  Switch,
  Text,
  useColorMode,
  useDisclosure,
} from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";
import { CloseIcon } from "../../ui/icons";
import { SiteSidebar } from "../-sidebar/sidebar";

function ProfileIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function ProfileLink() {
  return (
    <RouterLink
      to="/profile"
      minH="11"
      display="flex"
      alignItems="center"
      gap="1"
      px="2"
      color="fg"
      _current={{ fontWeight: "bold" }}
    >
      <ProfileIcon />
      <Text as="span" fontSize="sm">
        プロフィール
      </Text>
    </RouterLink>
  );
}

function ColorModeButton() {
  const { colorMode, toggleColorMode } = useColorMode();
  const nextColorMode = colorMode === "light" ? "dark" : "light";
  const colorModeLabel = colorMode === "light" ? "ライト" : "ダーク";
  const nextColorModeLabel = nextColorMode === "light" ? "ライト" : "ダーク";

  return (
    <IconButton
      aria-label={`現在は${colorModeLabel}モードです。${nextColorModeLabel}モードに切り替える`}
      onClick={toggleColorMode}
      boxSize="11"
      rounded="xl"
      variant="ghost"
      color="fg"
      _hover={{ bg: "bg.muted" }}
      icon={colorMode === "light" ? <SunIcon /> : <MoonIcon />}
    />
  );
}

/**
 * The header on every page: the site name (to the top) and the profile. The router marks the link
 * to the page being shown with `aria-current="page"`. The color mode switch (#3) goes next to the
 * profile link. The profile link spells out its name: it moves to a page, unlike the icon buttons
 * that act in place. At the `lg` breakpoint and below the site name leaves no room for them: the
 * menu has them, with the sidebar.
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
        <Flex display={{ base: "flex", lg: "none" }} align="center" gap="1">
          <ColorModeButton />
          <ProfileLink />
        </Flex>
        <SiteMenu />
      </Flex>
    </Box>
  );
}

/**
 * The menu at the `lg` breakpoint and below: the profile, the sidebar, and the color mode. It closes
 * on a link: one in the site moves to its page, one to a service opens in a new tab.
 */
function SiteMenu() {
  const { open, onOpen, onClose } = useDisclosure();
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <>
      <IconButton
        aria-label="メニュー"
        display={{ base: "none", lg: "inline-flex" }}
        boxSize="11"
        rounded="xl"
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
        <Drawer.Content bg="bg">
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
            <ProfileLink />
            <SiteSidebar />
            <Switch
              checked={colorMode === "dark"}
              onChange={toggleColorMode}
              minH="11"
              justifyContent="space-between"
              flexDirection="row-reverse"
            >
              ダークモード
            </Switch>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}
