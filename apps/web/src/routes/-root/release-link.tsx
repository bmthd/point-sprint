import { Status, Text } from "@workspaces/ui";
import { monthDay } from "../../ui/dates";
import { RouterLink } from "../../ui/router-link";
import {
  type Notice,
  isFreshRelease,
  latestRelease,
  notices as allNotices,
} from "../-notices/notices";
import { useToday } from "../-use-today";

const longDate = (date: string) => {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
};

/**
 * The site's version in the header, a link to the notice that raised it. Its dot is green while the
 * release is recent, gray once it is not, so a visitor sees the site is kept up. Below the `lg`
 * breakpoint the date is left out for room.
 */
export function ReleaseLink({
  notices = allNotices,
  now = () => new Date(),
}: {
  notices?: readonly Notice[];
  now?: () => Date;
}) {
  const today = useToday(now);
  const latest = latestRelease(notices);
  if (latest === undefined) return null;
  const { version } = latest.release;
  // Before the day is known, the release counts as recent: the build is newer than the release.
  const fresh = today === undefined || isFreshRelease(latest, today);
  return (
    <RouterLink
      to="/notices"
      hash={latest.id}
      aria-label={`Ver.${version}、${longDate(latest.date)}に更新。更新のお知らせを見る`}
      minH="11"
      display="flex"
      alignItems="center"
      gap="2"
      px="2"
      color="fg"
      _hover={{ textDecoration: "none", bg: "bg.muted" }}
      rounded="l2"
    >
      <Status
        as="span"
        size="sm"
        colorScheme={fresh ? "green" : "gray"}
        fontVariantNumeric="tabular-nums"
      >
        Ver.{version}
      </Status>
      <Text
        as="span"
        fontSize="xs"
        color="fg.muted"
        fontVariantNumeric="tabular-nums"
        display={{ base: "inline", lg: "none" }}
      >
        {monthDay(latest.date)} 更新
      </Text>
    </RouterLink>
  );
}
