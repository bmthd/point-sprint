/** Japanese digit grouping, retaining the locale's default decimal precision. */
export function grouped(value: number) {
  return value.toLocaleString("ja-JP");
}

export function optionalGrouped(value: number | undefined) {
  return value === undefined ? "" : grouped(value);
}

/** Round to two decimal places, then omit trailing zeroes. */
export function rounded(value: number) {
  return grouped(Number(value.toFixed(2)));
}

export function yen(value: number) {
  return `¥${grouped(value)}`;
}
export function pointsText(value: number) {
  return `${grouped(value)}P`;
}
export function rateText(rate: number, plus = true) {
  return `${plus ? "+" : ""}${rounded(rate)}倍`;
}
export function percent(rate: number) {
  return `${rounded(rate)}%`;
}

/** Shared results always show one decimal place, without digit grouping. */
export function fixedPercent(rate: number) {
  return `${rate.toFixed(1)}%`;
}
