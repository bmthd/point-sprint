import { POINT_GROUPS, type PointGroup } from "@workspaces/domain";
import type { Node } from "takumi-js";
import * as v from "valibot";
import { fixedPercent, pointsText } from "../../ui/format";
import { siteName } from "../../page-head";
import { siteUrl } from "../../site-url";

/** The kinds of event a shared result names, by the prefix of the official event's id. */
export const EVENT_KINDS = ["marathon", "brand-day"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * A plan's figures, as a shared result carries them. `rate` is left out when nothing is bought,
 * `breakdown` when the link has none, and `event` for a plan of no event.
 */
export type ResultFigures = {
  points: number;
  rate?: number;
  breakdown?: Record<PointGroup, number>;
  event?: EventKind;
};

/** A number from the query string: the router parses `2600`, a plain `URLSearchParams` gives `"2600"`. */
const QueryNumberSchema = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.nonEmpty(), v.decimal(), v.transform(Number))]),
  v.finite(),
);

const PointsSchema = v.fallback(
  v.optional(v.pipe(QueryNumberSchema, v.integer(), v.minValue(0), v.maxValue(99_999_999))),
  undefined,
);

/**
 * The figures in `/share` and its image's query string. A value that is missing or out of range
 * is dropped rather than refused, so a mangled link still opens the page.
 */
export const ResultSearchSchema = v.object({
  points: PointsSchema,
  rate: v.fallback(
    v.optional(v.pipe(QueryNumberSchema, v.minValue(0), v.maxValue(100))),
    undefined,
  ),
  base: PointsSchema,
  spu: PointsSchema,
  marathon: PointsSchema,
  campaign: PointsSchema,
  event: v.fallback(v.optional(v.picklist(EVENT_KINDS)), undefined),
});

/**
 * The figures of a parsed query, or `undefined` when it has no points. The breakdown is kept only
 * when all four groups are there and add up to the points.
 */
export function resultFigures(
  search: v.InferOutput<typeof ResultSearchSchema>,
): ResultFigures | undefined {
  const { points, rate, event } = search;
  if (points === undefined) return undefined;
  const values = POINT_GROUPS.map((group) => search[group]);
  const addsUp =
    values.every((value) => value !== undefined) &&
    values.reduce((sum, value) => sum + value, 0) === points;
  return {
    points,
    ...(rate === undefined ? {} : { rate }),
    ...(addsUp
      ? {
          breakdown: Object.fromEntries(
            POINT_GROUPS.map((group, i) => [group, values[i]]),
          ) as Record<PointGroup, number>,
        }
      : {}),
    ...(event === undefined ? {} : { event }),
  };
}

/** The kind of an official event, from the prefix of its id (`marathon-2026-10-24`). */
export function eventKindOf(officialEventId: string | undefined): EventKind | undefined {
  return EVENT_KINDS.find((kind) => officialEventId?.startsWith(`${kind}-`));
}

/**
 * The figures of a plan: `rate` is `effectiveRate`'s text, "—" when nothing is bought. A plan of
 * no points has nothing to break down.
 */
export function planFigures(
  result: { total: number; groupTotals: Record<PointGroup, number> },
  rate: string,
  officialEventId: string | undefined,
): ResultFigures {
  const event = eventKindOf(officialEventId);
  return {
    points: result.total,
    ...(rate === "—" ? {} : { rate: Number(rate) }),
    ...(result.total === 0 ? {} : { breakdown: { ...result.groupTotals } }),
    ...(event === undefined ? {} : { event }),
  };
}

const query = ({ points, rate, breakdown, event }: ResultFigures) =>
  new URLSearchParams({
    points: String(points),
    ...(rate === undefined ? {} : { rate: rate.toFixed(1) }),
    ...(breakdown === undefined
      ? {}
      : Object.fromEntries(POINT_GROUPS.map((group) => [group, String(breakdown[group])]))),
    ...(event === undefined ? {} : { event }),
  });

/** The page a result is shared as: it shows the figures, and social media show its image. */
export function resultPageUrl(figures: ResultFigures) {
  return `${siteUrl}/share?${query(figures)}`;
}

/** Path of the result's OGP image, drawn on request by the Worker. */
export function resultImagePath(figures: ResultFigures) {
  return `/share/image.png?${query(figures)}`;
}

/** "獲得ポイント 2,600P・実質還元率 6.5%" */
export function resultSummary({ points, rate }: ResultFigures) {
  const earned = `獲得ポイント ${pointsText(points)}`;
  return rate === undefined ? earned : `${earned}・実質還元率 ${fixedPercent(rate)}`;
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
  const points = pointsText(figures.points);
  const rate = figures.rate === undefined ? undefined : fixedPercent(figures.rate);
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
