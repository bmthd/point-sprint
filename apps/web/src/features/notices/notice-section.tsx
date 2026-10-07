import {
  Box,
  FormatDateTime,
  Heading,
  NativeAccordion,
  Separator,
  Text,
  VStack,
} from "@workspaces/ui";
import { SidebarSection } from "../layout/sidebar-section";
import { type Notice, newestFirst, notices as allNotices, paragraphs } from "./notices";

/** How many of the latest notices are open; the older ones are folded under one heading. */
const SHOWN = 3;

function NoticeItem({ notice }: { notice: Notice }) {
  return (
    <Box as="article" display="flex" flexDirection="column" gap="xs">
      <Box as="time" dateTime={notice.date} fontSize="xs" color="fg.muted">
        <FormatDateTime
          value={new Date(`${notice.date}T00:00:00+09:00`)}
          locale="ja-JP"
          timeZone="Asia/Tokyo"
          dateStyle="long"
        />
      </Box>
      <Heading as="h3" fontSize="sm">
        {notice.title}
      </Heading>
      {paragraphs(notice.body).map((paragraph) => (
        <Text key={paragraph} fontSize="sm" whiteSpace="pre-line">
          {paragraph}
        </Text>
      ))}
    </Box>
  );
}

function NoticeList({ notices }: { notices: readonly Notice[] }) {
  return (
    <VStack gap="md" alignItems="stretch" separator={<Separator />}>
      {notices.map((notice) => (
        <NoticeItem key={`${notice.date}-${notice.title}`} notice={notice} />
      ))}
    </VStack>
  );
}

/**
 * The notices in the sidebar, newest first. They are data in the source, so the HTML rendered at
 * build time has them all; the older ones sit in a native `<details>`.
 */
export function NoticeSection({ notices = allNotices }: { notices?: readonly Notice[] }) {
  const sorted = newestFirst(notices);
  const older = sorted.slice(SHOWN);
  return (
    <SidebarSection id="notices" title="お知らせ">
      {sorted.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          お知らせはありません。
        </Text>
      ) : (
        <NoticeList notices={sorted.slice(0, SHOWN)} />
      )}
      {older.length > 0 ? (
        <NativeAccordion.Root animate={false} borderTopWidth="1px" borderColor="border">
          <NativeAccordion.Item>
            <NativeAccordion.Button fontSize="sm" fontWeight="bold">
              以前のお知らせ（{older.length}件）
            </NativeAccordion.Button>
            <NativeAccordion.Panel>
              <NoticeList notices={older} />
            </NativeAccordion.Panel>
          </NativeAccordion.Item>
        </NativeAccordion.Root>
      ) : null}
    </SidebarSection>
  );
}
