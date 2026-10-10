import { List, Text } from "@workspaces/ui";
import { RouterLink } from "../../ui/router-link";
import { SidebarSection } from "../-sidebar/sidebar-section";
import { NoticeDate } from "./notice-date";
import { type Notice, newestFirst, notices as allNotices } from "./notices";

/** How many of the latest notices the sidebar lists. */
const SHOWN = 3;

/**
 * The latest notices in the sidebar: the date and the title only, each a link to the notice on
 * `/notices`, where it is in full.
 */
export function NoticeHeadlines({ notices = allNotices }: { notices?: readonly Notice[] }) {
  const latest = newestFirst(notices).slice(0, SHOWN);
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
                <NoticeDate date={notice.date} />
                <RouterLink to="/notices" hash={notice.id} fontSize="sm" color="link">
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
