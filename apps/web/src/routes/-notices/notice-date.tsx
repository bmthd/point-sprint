import { Box, FormatDateTime } from "@workspaces/ui";

/** The day a notice was posted, as `2026年10月8日`. */
export function NoticeDate({ date }: { date: string }) {
  return (
    <Box as="time" dateTime={date} fontSize="xs" color="fg.muted">
      <FormatDateTime
        value={new Date(`${date}T00:00:00+09:00`)}
        locale="ja-JP"
        timeZone="Asia/Tokyo"
        dateStyle="long"
      />
    </Box>
  );
}
