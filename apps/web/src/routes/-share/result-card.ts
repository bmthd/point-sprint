import { POINT_GROUPS, type PointGroup } from "@workspaces/domain";
import type { Node } from "takumi-js";
import * as v from "valibot";
import { fixedPercent, grouped, pointsText } from "../../ui/format";
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
const ink = "#222222";
const muted = "#5c5c5c";
const brand = "#bf0000";
const domain = new URL(siteUrl).host;
const tagline = "楽天のポイントを、上限まで計算するツール";
/** `public/icon.svg`, inlined: the Worker has no files to read it from. */
const icon = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#bf0000"/><g fill="#fff"><rect x="5" y="19" width="12" height="5" rx="2.5"/><rect x="2" y="29.5" width="15" height="5" rx="2.5"/><rect x="7" y="40" width="10" height="5" rx="2.5"/><path transform="translate(6 0) skewX(-12) translate(6 0)" d="M18 12H35a14 14 0 0 1 0 28H30v12H18Z M30 22v8h4a4 4 0 0 0 0-8Z"/></g></svg>',
)}`;

const eventNames: Record<EventKind, string> = {
  marathon: "お買い物マラソン",
  "brand-day": "楽天ブランドデー",
};

/** The same names as the plan's breakdown (`PointBreakdown`). */
const groupLabels: Record<PointGroup, string> = {
  base: "通常",
  spu: "SPU",
  marathon: "マラソン",
  campaign: "キャンペーン",
};

/** The light colors of `point.*`; campaign points are hatched, as on the plan. */
const groupFill = (group: PointGroup, stripe: number) =>
  ({
    base: "#a3a3a3",
    spu: "#5c5c5c",
    marathon: brand,
    campaign: `repeating-linear-gradient(45deg, #f7b23b 0 ${stripe}px, #ffffff ${stripe}px ${stripe * 2}px)`,
  })[group];

/** "お買い物マラソンの獲得ポイント", or "獲得ポイント" for a plan of no event. */
export function resultHeading(event: EventKind | undefined) {
  return event === undefined ? "獲得ポイント" : `${eventNames[event]}の獲得ポイント`;
}

const text = (value: string, style: Record<string, string | number>): Node => ({
  type: "text",
  text: value,
  style,
});

const row = (style: Record<string, string | number>, children: Node[]): Node => ({
  type: "container",
  style: { display: "flex", ...style },
  children,
});

/** The width of the card's content, inside its 64px sides. */
const contentWidth = 1200 - 64 * 2;

/**
 * The OGP image of a result: the points in brand red under the event, the rate beside them, and
 * the breakdown as a bar of colors with a legend under it. A link without a breakdown, or one of no
 * points, leaves the bar and the legend out.
 */
export function resultCard({ points, rate, breakdown, event }: ResultFigures): Node {
  const rateValue = rate === undefined ? undefined : fixedPercent(rate);
  const digits = grouped(points);
  // Smaller for long figures, so that they keep clear of the rate: a letter is about 0.6em wide,
  // and the P half the size.
  const rateWidth = rateValue === undefined ? 0 : rateValue.length * 0.6 * 68 + 40;
  const size = Math.min(
    152,
    Math.floor((contentWidth - rateWidth) / ((digits.length + 0.5) * 0.6)),
  );
  const groups = POINT_GROUPS.filter((group) => (breakdown?.[group] ?? 0) > 0);
  const sum = groups.reduce((total, group) => total + breakdown![group], 0);
  return {
    type: "container",
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "48px 64px 44px",
      background: "#ffffff",
      color: ink,
      fontFamily: `'${cardFontFamily}'`,
    },
    children: [
      row({ alignItems: "center", gap: 16 }, [
        { type: "image", src: icon, width: 52, height: 52, style: { width: 52, height: 52 } },
        text(siteName, { fontSize: 30, fontWeight: 700 }),
      ]),
      text(resultHeading(event), { marginTop: 28, fontSize: 34, color: muted }),
      row({ marginTop: 4, alignItems: "flex-end", justifyContent: "space-between" }, [
        row({ alignItems: "baseline", color: brand, fontWeight: 700, lineHeight: 1 }, [
          text(digits, { fontSize: size, letterSpacing: "-0.02em" }),
          text("P", { fontSize: Math.round(size / 2), marginLeft: 6 }),
        ]),
        ...(rateValue === undefined
          ? []
          : [
              row({ flexDirection: "column", alignItems: "flex-end", paddingBottom: 12 }, [
                text("還元率", { fontSize: 28, color: muted }),
                text(rateValue, { fontSize: 68, fontWeight: 700, lineHeight: 1.05 }),
              ]),
            ]),
      ]),
      ...(sum === 0
        ? []
        : [
            row(
              { marginTop: 28, height: 44, borderRadius: 10, overflow: "hidden" },
              groups.map((group) => ({
                type: "container",
                style: {
                  width: `${(breakdown![group] / sum) * 100}%`,
                  background: groupFill(group, 8),
                },
              })),
            ),
            row(
              { marginTop: 18, gap: 16 },
              groups.map((group) =>
                row({ width: (contentWidth - 16 * 3) / 4, flexDirection: "column", gap: 2 }, [
                  row({ alignItems: "center", gap: 10 }, [
                    {
                      type: "container",
                      style: {
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: groupFill(group, 4),
                      },
                    },
                    text(groupLabels[group], { fontSize: 26, color: muted }),
                  ]),
                  text(`${grouped(breakdown![group])}P`, {
                    fontSize: 42,
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }),
                ]),
              ),
            ),
          ]),
      row(
        {
          marginTop: "auto",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 24,
          color: muted,
        },
        [text(tagline, {}), text(domain, {})],
      ),
    ],
  };
}
