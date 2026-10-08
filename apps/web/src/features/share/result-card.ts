import type { Node } from "takumi-js";
import * as v from "valibot";
import { siteName, siteUrl } from "../../page-head";

/** A plan's figures, as a shared result carries them. `rate` is left out when nothing is bought. */
export type ResultFigures = { points: number; rate?: number };

/** A number from the query string: the router parses `2600`, a plain `URLSearchParams` gives `"2600"`. */
const queryNumber = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.nonEmpty(), v.decimal(), v.transform(Number))]),
  v.finite(),
);

/**
 * The figures in `/share` and its image's query string. A value that is missing or out of range
 * is dropped rather than refused, so a mangled link still opens the page.
 */
export const resultSearchSchema = v.object({
  points: v.fallback(
    v.optional(v.pipe(queryNumber, v.integer(), v.minValue(0), v.maxValue(99_999_999))),
    undefined,
  ),
  rate: v.fallback(v.optional(v.pipe(queryNumber, v.minValue(0), v.maxValue(100))), undefined),
});

/** The figures of a parsed query, or `undefined` when it has no points. */
export function resultFigures({
  points,
  rate,
}: v.InferOutput<typeof resultSearchSchema>): ResultFigures | undefined {
  if (points === undefined) return undefined;
  return rate === undefined ? { points } : { points, rate };
}

/** The figures of a plan: `rate` is `effectiveRate`'s text, "—" when nothing is bought. */
export function planFigures(total: number, rate: string): ResultFigures {
  return rate === "—" ? { points: total } : { points: total, rate: Number(rate) };
}

const query = ({ points, rate }: ResultFigures) =>
  new URLSearchParams({
    points: String(points),
    ...(rate === undefined ? {} : { rate: rate.toFixed(1) }),
  });

/** The page a result is shared as: it shows the figures, and social media show its image. */
export const resultPageUrl = (figures: ResultFigures) => `${siteUrl}/share?${query(figures)}`;

/** Path of the result's OGP image, drawn on request by the Worker. */
export const resultImagePath = (figures: ResultFigures) => `/share/image.png?${query(figures)}`;

export const formatPoints = (points: number) => `${points.toLocaleString("ja-JP")}P`;
export const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

/** "獲得予定 2,600P・実質還元率 6.5%" */
export function resultSummary({ points, rate }: ResultFigures) {
  const earned = `獲得予定 ${formatPoints(points)}`;
  return rate === undefined ? earned : `${earned}・実質還元率 ${formatRate(rate)}`;
}

export const imageSize = { width: 1200, height: 630 } as const;

/** The family the card's text is set in, registered under this name with each weight. */
export const cardFontFamily = "Noto Sans JP";
const brand = "#bf0000";
const event = "楽天市場お買い物マラソン";
const pointsLabel = "獲得予定";
const rateLabel = "実質還元率";
const calculated = "で計算";
const domain = new URL(siteUrl).host;

const text = (value: string, style: Record<string, string | number>): Node => ({
  type: "text",
  text: value,
  style,
});

const figure = (label: string, value: string, size: number): Node => ({
  type: "container",
  style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  children: [
    text(label, { fontSize: 36, color: "#57534e" }),
    text(value, { fontSize: size, fontWeight: 700, color: brand, lineHeight: 1.1 }),
  ],
});

/** The OGP image of a result: the points and the rate on a white card over the brand red. */
export function resultCard(figures: ResultFigures): Node {
  const points = formatPoints(figures.points);
  const rate = figures.rate === undefined ? undefined : formatRate(figures.rate);
  // Smaller for long figures, so that both fit on the card: a digit is about 0.6em wide.
  const letters = points.length + (rate?.length ?? 0);
  const size = Math.min(128, Math.floor(820 / (letters * 0.6)));
  return {
    type: "container",
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 36,
      background: brand,
      fontFamily: `'${cardFontFamily}'`,
    },
    children: [
      text(event, { fontSize: 40, color: "#ffffff", letterSpacing: "0.08em" }),
      {
        type: "container",
        style: {
          width: 1000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 72,
          padding: "40px 56px",
          borderRadius: 32,
          background: "#ffffff",
          boxShadow: "0 12px 40px rgba(0,0,0,.25)",
        },
        children: [
          figure(pointsLabel, points, size),
          ...(rate === undefined ? [] : [figure(rateLabel, rate, size)]),
        ],
      },
      {
        type: "container",
        style: { display: "flex", alignItems: "baseline", gap: 24, color: "#ffffff" },
        children: [
          text(`${siteName}${calculated}`, { fontSize: 44, fontWeight: 700 }),
          text(domain, { fontSize: 30, opacity: 0.85 }),
        ],
      },
    ],
  };
}
