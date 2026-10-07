import type { DateRule } from "@workspaces/domain";
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

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

type SettingsSaveFailure = {
  failurePlanId: string | undefined;
  setFailurePlanId: (planId: string | undefined) => void;
};

const SettingsSaveFailureContext = createContext<SettingsSaveFailure | undefined>(undefined);

/** Gives one settings view a failure state that disappears when the view unmounts. */
export function SettingsSaveFailureProvider({ children }: { children: ReactNode }) {
  const [failurePlanId, setFailurePlanId] = useState<string>();
  return createElement(
    SettingsSaveFailureContext,
    { value: { failurePlanId, setFailurePlanId } },
    children,
  );
}

function useSettingsSaveFailure() {
  const failure = useContext(SettingsSaveFailureContext);
  if (!failure) throw new Error("useSaveSettingsChange must be under SettingsSaveFailureProvider");
  return failure;
}

export function useSettingsSaveFailurePlanId() {
  return useSettingsSaveFailure().failurePlanId;
}

/** Saves a plan's settings change and reports the most recent failure for that plan. */
export function useSaveSettingsChange(planId: string) {
  const { setFailurePlanId } = useSettingsSaveFailure();
  return useCallback(
    (operation: Promise<unknown>) => {
      setFailurePlanId(undefined);
      operation.catch(() => setFailurePlanId(planId));
    },
    [planId, setFailurePlanId],
  );
}
