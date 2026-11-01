import { List, Status, Text } from "@workspaces/ui";
import { RouterLink } from "../../../ui/router-link";
import { SidebarSection } from "../../-sidebar/sidebar-section";
import { NoticeDate } from "../../-notices/notice-date";
import { type Notice, newestFirst, notices as allNotices } from "../../-notices/notices";
import { useUnreadNoticeIds } from "../../-notices/unread-notices";

/** How many of the latest notices the top page lists. */
const SHOWN = 3;

/**
 * The latest notices on the top page: the date and the title only, each a link to the notice on
 * `/notices`, where it is in full. A notice not read yet has a dot.
 */
export function NoticeHeadlines({ notices = allNotices }: { notices?: readonly Notice[] }) {
  const latest = newestFirst(notices).slice(0, SHOWN);
  const unread = useUnreadNoticeIds(notices);
  return (
    <SidebarSection title="お知らせ">
      {latest.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          お知らせはありません。
        </Text>
      ) : (
        <>
          <List.Root gap="3">
            {latest.map((notice) => (
              <List.Item
                key={notice.id}
                display="flex"
                flexDirection="column"
                gap="0.5"
                alignItems="start"
              >
                {unread.has(notice.id) ? (
                  <Status colorScheme="primary" size="sm" gap="1.5">
                    <NoticeDate date={notice.date} />
                  </Status>
                ) : (
                  <NoticeDate date={notice.date} />
                )}
                <RouterLink
                  to="/notices"
                  hash={notice.id}
                  fontSize="sm"
                  color="link"
                  aria-label={unread.has(notice.id) ? `${notice.title}（未読）` : undefined}
                >
                  {notice.title}
                </RouterLink>
              </List.Item>
            ))}
          </List.Root>
          <RouterLink to="/notices" fontSize="sm" color="link" alignSelf="end">
            すべてのお知らせ
          </RouterLink>
        </>
      )}
    </SidebarSection>
  );
}
