import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { noticeReadsQueryAtom } from "../../state/queries";
import { type Notice, notices as allNotices } from "./notices";

/**
 * The ids of the notices not read yet. Empty until the notices read have been read from storage,
 * so the HTML rendered ahead of time, which has no device data, marks none.
 */
export function useUnreadNoticeIds(notices: readonly Notice[] = allNotices): ReadonlySet<string> {
  const { data: reads } = useAtomValue(noticeReadsQueryAtom);
  return useMemo(() => {
    if (reads === undefined) return new Set();
    const read = new Set(reads.map((row) => row.id));
    return new Set(notices.map((notice) => notice.id).filter((id) => !read.has(id)));
  }, [reads, notices]);
}
