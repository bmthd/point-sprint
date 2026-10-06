import type { DateRule } from "@workspaces/domain";
import { atom, useSetAtom } from "jotai";
import { useCallback } from "react";

/** Rakuten's page where users check their own SPU. */
export const SPU_PAGE_URL = "https://event.rakuten.co.jp/campaign/point-up/everyday/point/";

/** Rakuten's service and campaign images are served from R2, not kept in the repository. */
const IMAGE_ORIGIN = "https://assets.bmth.dev/point-sprint";

/** A benefit's `imagePath` (`/img/...`) → the URL its image is served from. */
export const imageUrl = (imagePath: string) => `${IMAGE_ORIGIN}${imagePath}`;

/** `2026-10-06` → `10/6`. */
export const monthDay = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
};

/** When a campaign applies, as its toggle shows it. */
export function whenText(rule: DateRule | undefined): string {
  if (!rule) return "期間中ずっと";
  switch (rule.type) {
    case "daysOfMonth":
      return "日付で自動";
    case "dates":
      return rule.dates.map(monthDay).join("・");
    case "range":
      return `${monthDay(rule.start)}〜${monthDay(rule.end)}`;
  }
}

/** Set when saving a settings change failed; the settings show it until the next change. */
export const settingsSaveFailedAtom = atom(false);

/** Saves a settings change and reports a failure through `settingsSaveFailedAtom`. */
export function useSaveSettingsChange() {
  const setFailed = useSetAtom(settingsSaveFailedAtom);
  return useCallback(
    (operation: Promise<unknown>) => {
      setFailed(false);
      operation.catch(() => setFailed(true));
    },
    [setFailed],
  );
}
