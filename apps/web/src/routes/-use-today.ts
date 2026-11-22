import { useCallbackRef } from "@workspaces/ui";
import { atom, useAtomValue } from "jotai";
import { useCallback, useSyncExternalStore } from "react";
import { msUntilTokyoMidnight, tokyoToday } from "#/ui/dates.ts";

/**
 * A day that stands for today, the same ahead of time and in the browser: the help's figures draw
 * their sample plans on the day they were made. Unset, today is the real one.
 */
export const fixedTodayAtom = atom<string | undefined>(undefined);

/**
 * Today in Japan on the client. The HTML rendered ahead of time has the day of the build, which the
 * page also starts from while it hydrates; `undefined` where nothing sets it, as in the tests.
 */
export function useToday(now: () => Date): string | undefined {
  const fixed = useAtomValue(fixedTodayAtom);
  // `subscribe` calls the latest `now` so a new function on each render does not subscribe again.
  const latestNow = useCallbackRef(now);
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer: ReturnType<typeof setTimeout>;
      // Wakes up at each midnight in Japan, so the date changes while the page stays open.
      const schedule = () => {
        timer = setTimeout(() => {
          onChange();
          schedule();
        }, msUntilTokyoMidnight(latestNow()));
      };
      schedule();
      return () => clearTimeout(timer);
    },
    [latestNow],
  );
  const today = useSyncExternalStore(
    subscribe,
    () => tokyoToday(now()),
    () => import.meta.env.BUILD_DATE,
  );
  return fixed ?? today;
}
