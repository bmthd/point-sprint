import { useNotice, UseNoticeOptions } from "@yamada-ui/react";
import { FC, useEffect } from "react";

/**
 * Noticeを表示するためのEffectコンポーネント
 */
export const NoticeEffect: FC<{
  onNoticeBefore?: () => void;
  noticeOptions: UseNoticeOptions;
}> = ({ onNoticeBefore, noticeOptions }) => {
  const notice = useNotice();
  useEffect(() => {
    onNoticeBefore?.();
    notice(noticeOptions);
  }, [notice, noticeOptions, onNoticeBefore]);
  return null;
};
