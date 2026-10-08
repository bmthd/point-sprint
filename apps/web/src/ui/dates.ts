const tokyoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Japan as `YYYY-MM-DD`. */
export const tokyoToday = (now: Date): string => tokyoDate.format(now);

const DAY_MS = 24 * 60 * 60 * 1000;
/** Japan is 9 hours ahead of UTC all year. */
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Milliseconds from `now` to the next midnight in Japan. */
export const msUntilTokyoMidnight = (now: Date): number =>
  DAY_MS - ((((now.getTime() + TOKYO_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS);

const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;

const parts = (date: string) => {
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  return { year, month, day };
};

/** `2026-10-04` as `10/4`. */
export const monthDay = (date: string): string => {
  const { month, day } = parts(date);
  return `${month}/${day}`;
};

/** `2026-10-04` as `10/4（土）`. */
export const monthDayWithWeekday = (date: string): string => {
  const { year, month, day } = parts(date);
  return `${month}/${day}（${weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}）`;
};

export const monthOf = (date: string): number => parts(date).month;

/** `10/4〜10/9`, or just `10/4` for a one-day period. */
export const formatPeriod = (period: { start: string; end: string }): string =>
  period.start === period.end
    ? monthDay(period.start)
    : `${monthDay(period.start)}〜${monthDay(period.end)}`;
