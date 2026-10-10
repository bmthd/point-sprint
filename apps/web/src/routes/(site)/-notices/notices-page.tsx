import { Flex, Heading, Separator, Text, VStack } from "@workspaces/ui";
import { PageWithSidebar } from "../-sidebar/sidebar";
import { NoticeDate } from "./notice-date";
import { type Notice, newestFirst, notices as allNotices, paragraphs } from "./notices";

function NoticeArticle({ notice }: { notice: Notice }) {
  return (
    <Flex as="article" id={notice.id} direction="column" gap="2">
      <NoticeDate date={notice.date} />
      <Heading as="h2" fontSize="md">
        {notice.title}
      </Heading>
      {paragraphs(notice.body).map((paragraph) => (
        <Text key={paragraph} whiteSpace="pre-line">
          {paragraph}
        </Text>
      ))}
    </Flex>
  );
}

/**
 * The notices at `/notices`, newest first, each in full. They are data in the source, so the HTML
 * rendered at build time has them all.
 */
export function NoticesPage({ notices = allNotices }: { notices?: readonly Notice[] }) {
  const sorted = newestFirst(notices);
  return (
    <PageWithSidebar maxW="640px" noticeHeadlines={false}>
      <Heading as="h1" fontSize="lg" mb="4">
        お知らせ
      </Heading>
      {sorted.length === 0 ? (
        <Text color="fg.muted">お知らせはありません。</Text>
      ) : (
        <VStack gap="6" alignItems="stretch" separator={<Separator />}>
          {sorted.map((notice) => (
            <NoticeArticle key={notice.id} notice={notice} />
          ))}
        </VStack>
      )}
    </PageWithSidebar>
  );
}
