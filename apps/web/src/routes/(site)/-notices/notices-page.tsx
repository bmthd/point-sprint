import { Card, Flex, Heading, Separator, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { markNoticesReadAtom } from "../../../state/mutations";
import { PageWithSidebar } from "../-page-with-sidebar";
import { NoticeDate } from "../../-notices/notice-date";
import { ColumnHead } from "../../../ui/column-head";
import {
  type Notice,
  newestFirst,
  notices as allNotices,
  paragraphs,
} from "../../-notices/notices";

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
 * rendered at build time has them all. Opening the page reads every notice on it.
 */
export function NoticesPage({ notices = allNotices }: { notices?: readonly Notice[] }) {
  const sorted = newestFirst(notices);
  const { mutate: markRead } = useAtomValue(markNoticesReadAtom);
  useEffect(() => {
    markRead(notices.map((notice) => notice.id));
  }, [notices, markRead]);
  return (
    <PageWithSidebar maxW="640px">
      <ColumnHead mb="2.5">
        <Heading as="h1" fontSize="lg">
          お知らせ
        </Heading>
      </ColumnHead>
      <Card.Root>
        <Card.Body alignItems="stretch">
          {sorted.length === 0 ? (
            <Text color="fg.muted">お知らせはありません。</Text>
          ) : (
            <VStack gap="6" alignItems="stretch" separator={<Separator />}>
              {sorted.map((notice) => (
                <NoticeArticle key={notice.id} notice={notice} />
              ))}
            </VStack>
          )}
        </Card.Body>
      </Card.Root>
    </PageWithSidebar>
  );
}
