import type { OfficialEvent, Period } from "@workspaces/domain";

// Reads Rakuten's marathon pages and its Black Friday page, which its CMS writes. Each reader looks for the few labels and
// class names the facts sit under, and gives `undefined` for what it cannot find: the pages change
// without notice, and a page read wrong must not reach the master (event-collection.ts).

export const SCHEDULE_URL = "https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/";
export const MARATHON_URL = "https://event.rakuten.co.jp/campaign/point-up/marathon/";
/** Shows Black Friday, a shop-around like the marathon's, in the same campaign details. */
export const BLACK_FRIDAY_URL = "https://event.rakuten.co.jp/campaign/point-up/blackfriday/";
/**
 * Shows 楽天スーパーSALE's shop-around in the same campaign details, after the 先行セール's and the
 * 楽天モバイル users' own.
 */
export const SUPERSALE_URL = "https://event.rakuten.co.jp/campaign/supersale/";

/** A round on the schedule page, as 「第二弾」 and its period. */
export type ScheduledRound = { title: string; period: Period; times?: OfficialEvent["times"] };

/** The round the marathon page shows from its entry until its end. */
export type CurrentRound = {
  campaignName: string;
  period: Period;
  times?: OfficialEvent["times"];
  /** The most the shop-around pays, as on the page (10 for 「最大10倍」), the usual 1倍 included. */
  maxRate: number;
  /** 「獲得上限ポイント数」. */
  cap: number;
};

/**
 * The page without its comments: the schedule page keeps lines it does not show, such as each
 * round's cap, inside them, and those are not always right.
 */
const withoutComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

const pad = (value: string) => value.padStart(2, "0");

/**
 * The days of 「2026年10月14日(水)20:00～2026年10月17日(土)09:59」, and their times when it has
 * both.
 */
export function periodOf(
  text: string,
): { period: Period; times?: OfficialEvent["times"] } | undefined {
  const ends = [
    ...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?\s*(?:(\d{1,2}):(\d{2}))?/g),
  ].map(([, year = "", month = "", day = "", hour, minute]) => ({
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: hour && minute ? `${pad(hour)}:${minute}` : undefined,
  }));
  const [start, end] = ends;
  if (ends.length !== 2 || !start || !end) return undefined;
  const period = { start: start.date, end: end.date };
  return start.time && end.time
    ? { period, times: { start: start.time, end: end.time } }
    : { period };
}

/** The rounds of the month on the schedule page, in the order it lists them. */
export function readSchedule(html: string): ScheduledRound[] {
  const rounds: ScheduledRound[] = [];
  const pattern =
    /class="marathonCalender-title">\s*<span>([^<]*)<\/span>[\s\S]*?class="marathonCalender-lead">([^<]*)<\/p>/g;
  for (const [, title = "", lead = ""] of withoutComments(html).matchAll(pattern)) {
    const read = periodOf(lead);
    // 「第二弾!」 is shown as 「第二弾」.
    const name = title.trim().replace(/[!！]+$/, "");
    if (read && name) rounds.push({ title: name, ...read });
  }
  return rounds;
}

/**
 * The HTML of the group headed `heading` in the page's campaign details, up to the next group, or
 * `undefined` when the page has no such group.
 */
function detailGroup(html: string, heading: string): string | undefined {
  const start = html.indexOf(`<div class="font-weight-700">${heading}</div>`);
  if (start < 0) return undefined;
  const next = html.indexOf('class="ecm-campaign-details-group', start);
  return html.slice(start, next < 0 ? undefined : next);
}

const textOf = (html: string) => html.replace(/<[^>]*>/g, "").trim();

const toNumber = (text: string | undefined) =>
  text === undefined ? undefined : Number(text.replaceAll(",", ""));

/**
 * The rounds in the page's campaign details, one for each 「キャンペーン名：」 that can be read, in
 * the order the page shows them. The marathon page shows one; between rounds it says only
 * 「終了しました」 and shows none.
 */
export function readShownRounds(html: string): CurrentRound[] {
  const page = withoutComments(html);
  const starts = [...page.matchAll(/キャンペーン名：/g)].map((match) => match.index);
  return starts.flatMap((start, index) => {
    const round = readCampaignDetails(page.slice(start, starts[index + 1]));
    return round ? [round] : [];
  });
}

/** The round on the marathon page: the first `readShownRounds` gives. */
export function readCurrentRound(html: string): CurrentRound | undefined {
  return readShownRounds(html)[0];
}

/** The round of one campaign's details, or `undefined` when what they show cannot be read. */
function readCampaignDetails(details: string): CurrentRound | undefined {
  const campaignName = /キャンペーン名：([^<]*)</.exec(details)?.[1]?.trim();
  const periodGroup = detailGroup(details, "ポイントアップ期間");
  const benefitGroup = detailGroup(details, "キャンペーン特典");
  if (!campaignName || !periodGroup || !benefitGroup) return undefined;
  const { period, times } = periodOf(textOf(periodGroup)) ?? {};
  // 「購入ショップ数に応じ、ポイント倍率が2倍、3倍と最大10倍まで増加」
  const maxRate = toNumber(/ポイント倍率が2倍、3倍と最大(\d+)倍まで増加/.exec(benefitGroup)?.[1]);
  // 「獲得上限ポイント数」 and, in the paragraph after it, 「7,000ポイント(期間限定)」.
  const cap = toNumber(
    /獲得上限ポイント数<\/div>\s*<p[^>]*>\s*([\d,]+)ポイント/.exec(benefitGroup)?.[1],
  );
  // 「※11ショップ以上での購入も10倍です。」: no more than at 10 shops.
  const beyond = toNumber(/11ショップ以上での購入も(\d+)倍/.exec(benefitGroup)?.[1]);
  if (!period || maxRate === undefined || cap === undefined || beyond !== maxRate) return undefined;
  return { campaignName, period, ...(times ? { times } : {}), maxRate, cap };
}

/** 楽天スーパーSALE's 「楽天モバイルご利用者限定 先行セール」, from and to, in Japan with the offset. */
export type PresaleWindow = { start: string; end: string };

/**
 * The 先行セール the page shows in its 「先行セール期間」, or `undefined` when it shows none or its
 * period has no times. The group lists 「楽天モバイルご利用者限定先行セール期間」 and the period under
 * it, then 「12月楽天スーパーSALEお買い物期間」 and its own.
 */
export function readPresale(html: string): PresaleWindow | undefined {
  const group = detailGroup(withoutComments(html), "先行セール期間");
  if (!group) return undefined;
  const lines = [...group.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(([, line = ""]) =>
    textOf(line),
  );
  const label = lines.findIndex(
    (line) => line.includes("楽天モバイル") && line.includes("先行セール期間"),
  );
  const read = label < 0 ? undefined : periodOf(lines[label + 1] ?? "");
  if (!read?.times) return undefined;
  return {
    start: `${read.period.start}T${read.times.start}+09:00`,
    end: `${read.period.end}T${read.times.end}+09:00`,
  };
}
