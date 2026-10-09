import { Box, IconButton, MoonIcon, SunIcon, Text, useColorMode } from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";

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
 * that act in place.
 */
export function SiteHeader() {
  return (
    <Box as="header" borderBottomWidth="1px" borderColor="border">
      <Box
        maxW="1280px"
        mx="auto"
        h="14"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
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
        <Box display="flex" alignItems="center" gap="1">
          <ColorModeButton />
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
        </Box>
      </Box>
    </Box>
  );
}
