import { NativeAccordion, Text } from "@workspaces/ui";
import { InfoPage, InfoSection, Paragraphs } from "./info-page";
import { type Notice, formatNoticeDate, newestFirst, notices } from "./notices";

function NoticeDate({ notice }: { notice: Notice }) {
  return (
    <Text as="time" dateTime={notice.date} fontSize="sm" color="fg.muted">
      {formatNoticeDate(notice.date)}
    </Text>
  );
}

/** The notices at `/notices`: the newest one open, the older ones opened one by one. */
export function NoticeList() {
  const [latest, ...older] = newestFirst(notices);
  return (
    <InfoPage title="お知らせ">
      {latest ? (
        <InfoSection id="latest" title={latest.title}>
          <NoticeDate notice={latest} />
          <Paragraphs lines={latest.body} />
        </InfoSection>
      ) : null}
      {older.length > 0 ? (
        <InfoSection id="older" title="過去のお知らせ">
          <NativeAccordion.Root animate={false}>
            {older.map((notice) => (
              <NativeAccordion.Item key={`${notice.date}-${notice.title}`}>
                <NativeAccordion.Button>
                  {formatNoticeDate(notice.date)} {notice.title}
                </NativeAccordion.Button>
                <NativeAccordion.Panel>
                  <Paragraphs lines={notice.body} />
                </NativeAccordion.Panel>
              </NativeAccordion.Item>
            ))}
          </NativeAccordion.Root>
        </InfoSection>
      ) : null}
    </InfoPage>
  );
}
