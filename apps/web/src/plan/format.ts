export const pointsText = (value: number) => `${value.toLocaleString("ja-JP")}P`;

export const rateText = (rate: number, plus = true) =>
  `${plus ? "+" : ""}${Number(rate.toFixed(2)).toLocaleString("ja-JP")}倍`;

export const taxRateLabel = (rate: number) =>
  rate === 0 ? "非課税" : `${Math.round(rate * 100)}%`;
