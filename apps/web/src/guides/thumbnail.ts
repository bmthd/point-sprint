import type { Node } from "takumi-js";
import type { Article } from "./article.ts";

// A guide's thumbnail: its OGP image, and the picture on the cards that link to it. The build draws
// one for each guide (`guide-thumbnails-plugin.ts`) and serves it as a file.

export const thumbnailSize = { width: 1200, height: 630 } as const;

/** The family the thumbnail's text is set in, registered under this name with each weight. */
export const thumbnailFontFamily = "Noto Sans JP";

/** The weights the thumbnail draws with. */
export const thumbnailFontWeights = [700, 900] as const;

/** Path of a guide's thumbnail, next to the guide's other images in `public/guides/<slug>/`. */
export function thumbnailPath(slug: string) {
  return `/guides/${slug}/thumbnail.png`;
}

type ThumbnailText = Pick<Article, "title" | "cardLead" | "cardFigure">;

/** The text the thumbnail shows, for its `alt`: the lead and the figure, or the title. */
export function thumbnailAlt({ title, cardLead, cardFigure }: ThumbnailText) {
  return cardLead === undefined || cardFigure === undefined ? title : `${cardLead} ${cardFigure}`;
}

const ink = "#1d1a1a";
const muted = "#4a4242";
const brand = "#bf0000";
const sideWidth = 84;
const contentWidth = thumbnailSize.width - sideWidth * 2;
/** `public/icon.svg` with its colors turned over, to stand on the red band. */
const icon = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#fff"/><g fill="#bf0000"><rect x="5" y="19" width="12" height="5" rx="2.5"/><rect x="2" y="29.5" width="15" height="5" rx="2.5"/><rect x="7" y="40" width="10" height="5" rx="2.5"/><path transform="translate(6 0) skewX(-12) translate(6 0)" d="M18 12H35a14 14 0 0 1 0 28H30v12H18Z M30 22v8h4a4 4 0 0 0 0-8Z"/></g></svg>',
)}`;

type Style = Record<string, string | number>;

const text = (value: string, style: Style): Node => ({ type: "text", text: value, style });

const box = (style: Style, children: Node[]): Node => ({
  type: "container",
  style: { display: "flex", ...style },
  children,
});

/**
 * The figure split into runs: digits and their commas drawn full size, the words around them at
 * half. A figure without digits ("順番では変わらない") is drawn full size throughout.
 */
export function figureRuns(figure: string) {
  if (!/\d/.test(figure)) return [{ text: figure, large: true }];
  return figure
    .split(/([\d,.]+)/)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, large: /^[\d,.]+$/.test(part) }));
}

/** The width of a run in em: digits and commas are about half as wide as a Japanese letter. */
const runWidth = (run: string) =>
  [...run].reduce((width, letter) => width + (/[\d,.]/.test(letter) ? 0.6 : 1), 0);

/** The largest size, up to 140px, at which the figure fits on one line. */
export function figureSize(figure: string) {
  const em = figureRuns(figure).reduce(
    (width, run) => width + runWidth(run.text) * (run.large ? 1 : 0.5),
    0,
  );
  return Math.min(140, Math.floor(contentWidth / em));
}

const band: Node = box(
  {
    justifyContent: "space-between",
    alignItems: "center",
    padding: `24px ${sideWidth}px`,
    background: brand,
    color: "#ffffff",
    fontSize: 32,
    fontWeight: 700,
  },
  [
    box({ alignItems: "center", gap: 14 }, [
      { type: "image", src: icon, width: 44, height: 44, style: { width: 44, height: 44 } },
      text("ポイントスプリント", {}),
    ]),
    text("買い物ガイド", {}),
  ],
);

/**
 * The thumbnail of a guide: the lead, the figure in large red letters, and the title under them,
 * centred, so that a square cut from the middle (Google's results on a phone) keeps the figure. A
 * guide without `cardLead` and `cardFigure` shows its title alone, large.
 */
export function thumbnail({ title, cardLead, cardFigure }: ThumbnailText): Node {
  const center: Style = { textAlign: "center", justifyContent: "center", textWrap: "balance" };
  const body =
    cardLead === undefined || cardFigure === undefined
      ? [text(title, { ...center, fontSize: 72, fontWeight: 900, lineHeight: 1.35 })]
      : [
          text(cardLead, { ...center, fontSize: 44, fontWeight: 700, color: muted }),
          box(
            { ...center, alignItems: "baseline", color: brand, fontWeight: 900, lineHeight: 1.15 },
            figureRuns(cardFigure).map((run) =>
              text(run.text, {
                fontSize: Math.round(figureSize(cardFigure) * (run.large ? 1 : 0.5)),
              }),
            ),
          ),
          text(title, { ...center, fontSize: 34, fontWeight: 700, lineHeight: 1.4 }),
        ];
  return box(
    {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      background: "#ffffff",
      color: ink,
      fontFamily: `'${thumbnailFontFamily}'`,
    },
    [
      box(
        {
          flexGrow: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          padding: `40px ${sideWidth}px`,
        },
        body,
      ),
      band,
    ],
  );
}
