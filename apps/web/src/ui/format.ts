/** Japanese digit grouping, retaining the locale's default decimal precision. */
export const grouped = (value: number) => value.toLocaleString("ja-JP");

export const optionalGrouped = (value: number | undefined) =>
  value === undefined ? "" : grouped(value);

/** Round to two decimal places, then omit trailing zeroes. */
export const rounded = (value: number) => grouped(Number(value.toFixed(2)));

export const yen = (value: number) => `¥${grouped(value)}`;
export const pointsText = (value: number) => `${grouped(value)}P`;
export const rateText = (rate: number, plus = true) => `${plus ? "+" : ""}${rounded(rate)}倍`;
export const percent = (rate: number) => `${rounded(rate)}%`;

/** Shared results always show one decimal place, without digit grouping. */
export const fixedPercent = (rate: number) => `${rate.toFixed(1)}%`;
