import { useCallback, useSyncExternalStore } from "react";
import { msUntilTokyoMidnight, tokyoToday } from "../ui/dates";
import { useLatestRef } from "../use-latest-ref";

/**
 * Today in Japan on the client. The HTML rendered ahead of time has the day of the build, which the
 * page also starts from while it hydrates; `undefined` where nothing sets it, as in the tests.
 */
export function useToday(now: () => Date): string | undefined {
  // `subscribe` reads `now` through a ref so a new function on each render does not subscribe again.
  const nowRef = useLatestRef(now);
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer: ReturnType<typeof setTimeout>;
      // Wakes up at each midnight in Japan, so the date changes while the page stays open.
      const schedule = () => {
        timer = setTimeout(() => {
          onChange();
          schedule();
        }, msUntilTokyoMidnight(nowRef.current()));
      };
      schedule();
      return () => clearTimeout(timer);
    },
    [nowRef],
  );
  return useSyncExternalStore(
    subscribe,
    () => tokyoToday(now()),
    () => import.meta.env.BUILD_DATE,
  );
}
