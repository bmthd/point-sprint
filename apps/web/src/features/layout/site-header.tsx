import { Box } from "@workspaces/ui";
import { RouterLink } from "../plan-list/router-link";

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

/**
 * The header on every page: the site name (to the top) and the profile. The router marks the link
 * to the page being shown with `aria-current="page"`. The color mode switch (#3) goes next to the
 * profile link.
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
          <RouterLink
            to="/profile"
            aria-label="プロフィール（SPU・ショップ台帳）"
            boxSize="11"
            display="flex"
            alignItems="center"
            justifyContent="center"
            rounded="xl"
            color="fg"
            _hover={{ bg: "bg.muted" }}
            _current={{ bg: "bg.muted" }}
          >
            <ProfileIcon />
          </RouterLink>
        </Box>
      </Box>
    </Box>
  );
}
