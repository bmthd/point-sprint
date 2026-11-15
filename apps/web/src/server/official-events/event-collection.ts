import { type Benefit, type OfficialEvent, OfficialEventSchema } from "@workspaces/domain";
import * as v from "valibot";
import {
  BLACK_FRIDAY_URL,
  MARATHON_URL,
  SCHEDULE_URL,
  type CurrentRound,
  type ScheduledRound,
  readCurrentRound,
  readSchedule,
} from "./event-pages.ts";

// Turns the marathon pages and the Black Friday page into rows of the event master (event-store.ts). A row is published only
// when it passes the checks below; otherwise the row already published stays as it is, and the
// reason goes into the run's message, where the operator finds it (docs/event-master.md).

/**
 * `published` rows are served; `pending` ones failed a check and wait for the operator; `rejected`
 * ones were turned down by the operator.
 */
export type EventStatus = "published" | "pending" | "rejected";

export type StoredEvent = {
  event: OfficialEvent;
  status: EventStatus;
  /** Fixed by the operator: collection leaves it alone. */
  locked: boolean;
};

export type EventWrite = {
  event: OfficialEvent;
  status: "published" | "pending";
  sourceUrl: string;
};

export type RunOutcome = "ok" | "warning" | "failed";

export type Collection = { writes: EventWrite[]; outcome: RunOutcome; notes: string[] };

/**
 * 「最大10倍」 on the guide (docs/event-master.md), used until a round's own page shows its rate:
 * 「最大は10ショップ購入時のポイント10倍です」.
 */
const GUIDE_MAX_RATE = 10;

const daysBetween = (start: string, end: string) =>
  (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;

/** What makes `event` unlikely to be what Rakuten announced, or `[]` when nothing does. */
export function checkEvent(event: OfficialEvent): string[] {
  const parsed = v.safeParse(OfficialEventSchema, event);
  if (!parsed.success) {
    return parsed.issues.map(
      (issue) => `形が正しくない（${v.getDotPath(issue) ?? "全体"}: ${issue.message}）`,
    );
  }
  const problems: string[] = [];
  const days = daysBetween(event.period.start, event.period.end);
  if (!(days >= 2 && days <= 14)) problems.push(`期間が ${days} 日`);
  for (const benefit of event.benefits) {
    if (benefit.kind !== "shop-around") continue;
    // The pages count the usual 1倍 in; the tiers leave it out.
    const maxRate = Math.max(...benefit.params.tiers.map((tier) => tier.rate)) + 1;
    if (!(maxRate >= 1 && maxRate <= 20)) problems.push(`倍率が最大 ${maxRate} 倍`);
    const { cap } = benefit.params;
    if (cap !== undefined && !(cap >= 1000 && cap <= 100_000)) problems.push(`上限が ${cap}`);
  }
  return problems;
}

/**
 * A shop-around campaign as an event: 2〜10 shops pay 2〜10倍 when `maxRate` is 10, and the
 * shop-around keeps `benefitId` across updates.
 */
function shopAroundEvent(input: {
  id: string;
  name: string;
  period: OfficialEvent["period"];
  times?: OfficialEvent["times"];
  maxRate: number;
  cap: number | undefined;
  benefitId: string;
}): OfficialEvent {
  const { id, name, period, times, maxRate, cap, benefitId } = input;
  const shopAround: Benefit = {
    id: benefitId,
    kind: "shop-around",
    category: "campaign",
    label: "ショップ買いまわり",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "campaign",
    sharedKey: id,
    conditions: { dateRule: { type: "range", ...period } },
    params: {
      // 「購入ショップ数に応じ、ポイント倍率が2倍、3倍と最大10倍まで増加」, less the usual 1倍.
      tiers: Array.from({ length: maxRate - 1 }, (_, index) => ({
        minShops: index + 2,
        rate: index + 1,
      })),
      ...(cap === undefined ? {} : { cap }),
      roundingUnit: "item",
    },
  };
  return {
    id,
    name,
    period: { ...period },
    ...(times ? { times: { ...times } } : {}),
    benefits: [shopAround],
  };
}

/** The marathon round as an event, named 「お買い物マラソン」 and its title. */
export function marathonEvent(input: {
  round: ScheduledRound;
  maxRate: number;
  cap: number | undefined;
  benefitId: string;
}): OfficialEvent {
  const { round, ...rest } = input;
  return shopAroundEvent({
    id: `marathon-${round.period.start}`,
    name: `お買い物マラソン${round.title}`,
    period: round.period,
    ...(round.times ? { times: round.times } : {}),
    ...rest,
  });
}

/** JSON with the keys of each object sorted, so two events built differently compare equal. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

const shopAroundOf = (event: OfficialEvent | undefined) => {
  const benefit = event?.benefits.find((candidate) => candidate.kind === "shop-around");
  return benefit?.kind === "shop-around" ? benefit : undefined;
};

const samePeriod = (a: ScheduledRound["period"], b: ScheduledRound["period"]) =>
  a.start === b.start && a.end === b.end;

const overlaps = (a: ScheduledRound["period"], b: ScheduledRound["period"]) =>
  a.start <= b.end && b.start <= a.end;

const MARATHON_NAME = "お買い物マラソン";

/** The run's message so far: a warning is a note that also turns the outcome to `warning`. */
type RunLog = { notes: string[]; outcome: RunOutcome };

function warn(log: RunLog, note: string) {
  log.notes.push(note);
  log.outcome = "warning";
}

/**
 * The round the marathon page shows, if it can be trusted, and `ahead` when the schedule page does
 * not list that round yet.
 */
function readMarathonPage(
  marathon: { html: string } | { error: string },
  rounds: readonly ScheduledRound[],
  log: RunLog,
): { current?: CurrentRound; ahead?: ScheduledRound } {
  if ("error" in marathon) {
    warn(log, `マラソンのページを取得できない（${marathon.error}）`);
    return {};
  }
  const current = readCurrentRound(marathon.html);
  // Between rounds, the page says only 「終了しました」.
  if (!current) {
    log.notes.push("マラソンのページに開催中・開催直前の回がない");
    return {};
  }
  if (!current.campaignName.startsWith(MARATHON_NAME)) {
    warn(log, `マラソンのページのキャンペーン名が「${current.campaignName}」`);
    return {};
  }
  if (rounds.some((round) => samePeriod(round.period, current.period))) return { current };
  // The schedule page shows a month's rounds, and the marathon page may show the next month's
  // first round before the schedule page moves on (2026-11-02). A round that overlaps one on the
  // schedule page is more likely read wrong.
  if (rounds.some((round) => overlaps(round.period, current.period))) {
    warn(
      log,
      `マラソンのページの期間 ${current.period.start}〜${current.period.end} がスケジュールのページにない`,
    );
    return {};
  }
  const ahead: ScheduledRound = {
    // marathonEvent names the round 「お買い物マラソン」 and its title, so this gives the
    // campaign's name, such as 「お買い物マラソン&ジャンル祭」.
    title: current.campaignName.slice(MARATHON_NAME.length),
    period: current.period,
    ...(current.times ? { times: current.times } : {}),
  };
  return { current, ahead };
}

/** Whether the operator fixed or turned down the stored row, which collection then leaves alone. */
function heldByOperator(id: string, existing: StoredEvent | undefined, log: RunLog): boolean {
  if (!existing?.locked && existing?.status !== "rejected") return false;
  log.notes.push(`${id}: ${existing.locked ? "固定" : "却下"}されているので更新しない`);
  return true;
}

/**
 * The row to write for `event`, or `undefined` when the stored row should stay: the stored row is
 * the same, or `event` fails the checks and a row is already stored. `noted` words the note for
 * 「追加」 or 「更新」.
 */
function checkedWrite(
  input: {
    event: OfficialEvent;
    existing: StoredEvent | undefined;
    sourceUrl: string;
    noted: (change: string) => string;
  },
  log: RunLog,
): EventWrite | undefined {
  const { event, existing, sourceUrl, noted } = input;
  const problems = checkEvent(event);
  if (problems.length > 0) {
    warn(log, `${event.id}: ${problems.join("、")}`);
    // The row already published stays; a new one waits for the operator.
    return existing ? undefined : { event, status: "pending", sourceUrl };
  }
  if (existing?.status === "published" && canonical(existing.event) === canonical(event)) {
    return undefined;
  }
  log.notes.push(noted(existing ? "更新" : "追加"));
  return { event, status: "published", sourceUrl };
}

/** The row to write for one round, or `undefined` when the stored row should stay. */
function writeRound(
  input: {
    round: ScheduledRound;
    /** The marathon page's reading of this round, when it shows it. */
    shown: CurrentRound | undefined;
    existing: StoredEvent | undefined;
    /** Only on the marathon page, not yet on the schedule page. */
    ahead: boolean;
    newId: () => string;
  },
  log: RunLog,
): EventWrite | undefined {
  const { round, shown, existing, ahead, newId } = input;
  const id = `marathon-${round.period.start}`;
  if (heldByOperator(id, existing, log)) return undefined;
  // The marathon page leaves at the round's end; the cap read while it showed the round stays.
  const keepsCap =
    existing &&
    shopAroundOf(existing.event)?.params.cap !== undefined &&
    samePeriod(existing.event.period, round.period);
  if (!shown && keepsCap) return undefined;
  const event = marathonEvent({
    round,
    maxRate: shown?.maxRate ?? GUIDE_MAX_RATE,
    cap: shown?.cap,
    benefitId: shopAroundOf(existing?.event)?.id ?? newId(),
  });
  return checkedWrite(
    {
      event,
      existing,
      sourceUrl: shown ? MARATHON_URL : SCHEDULE_URL,
      noted: (change) =>
        ahead
          ? `${id}: スケジュールのページにまだない回を、マラソンのページから${change}`
          : `${id}: ${change}`,
    },
    log,
  );
}

/**
 * The rows to write for the rounds that have not ended by `today` (`YYYY-MM-DD` in Japan). A round
 * the marathon page does not show yet goes in with its period and the guide's rate, and no cap. A
 * round the marathon page shows before the schedule page lists it goes in under the campaign's name
 * until the schedule page gives it one.
 */
export function collectMarathon(input: {
  scheduleHtml: string;
  /** The marathon page, or why it could not be fetched. */
  marathon: { html: string } | { error: string };
  today: string;
  stored: ReadonlyMap<string, StoredEvent>;
  newId: () => string;
}): Collection {
  const { scheduleHtml, marathon, today, stored, newId } = input;
  const rounds = readSchedule(scheduleHtml);
  if (rounds.length === 0) {
    return { writes: [], outcome: "failed", notes: ["スケジュールのページから回を読めない"] };
  }
  const log: RunLog = { notes: [], outcome: "ok" };
  const { current, ahead } = readMarathonPage(marathon, rounds, log);
  const writes: EventWrite[] = [];
  for (const round of ahead ? [...rounds, ahead] : rounds) {
    if (round.period.end < today) continue;
    const write = writeRound(
      {
        round,
        shown: current && samePeriod(current.period, round.period) ? current : undefined,
        existing: stored.get(`marathon-${round.period.start}`),
        ahead: round === ahead,
        newId,
      },
      log,
    );
    if (write) writes.push(write);
  }
  return { writes, ...log };
}

const BLACK_FRIDAY_NAME = "ブラックフライデー";

/**
 * The row to write for the Black Friday the page shows, from its entry until its end, under the
 * campaign's name (「楽天市場のブラックフライデー」). The rest of the year the page shows none, or
 * cannot be fetched, and that is no warning.
 */
export function collectBlackFriday(input: {
  /** The Black Friday page, or why it could not be fetched. */
  page: { html: string } | { error: string };
  today: string;
  stored: ReadonlyMap<string, StoredEvent>;
  newId: () => string;
}): Collection {
  const { page, today, stored, newId } = input;
  const log: RunLog = { notes: [], outcome: "ok" };
  if ("error" in page) {
    log.notes.push(`ブラックフライデーのページを取得できない（${page.error}）`);
    return { writes: [], ...log };
  }
  const shown = readCurrentRound(page.html);
  if (!shown) {
    log.notes.push("ブラックフライデーのページに開催中・開催直前の回がない");
    return { writes: [], ...log };
  }
  if (!shown.campaignName.includes(BLACK_FRIDAY_NAME)) {
    warn(log, `ブラックフライデーのページのキャンペーン名が「${shown.campaignName}」`);
    return { writes: [], ...log };
  }
  if (shown.period.end < today) return { writes: [], ...log };
  const id = `black-friday-${shown.period.start}`;
  const existing = stored.get(id);
  if (heldByOperator(id, existing, log)) return { writes: [], ...log };
  const event = shopAroundEvent({
    id,
    name: shown.campaignName,
    period: shown.period,
    ...(shown.times ? { times: shown.times } : {}),
    maxRate: shown.maxRate,
    cap: shown.cap,
    benefitId: shopAroundOf(existing?.event)?.id ?? newId(),
  });
  const write = checkedWrite(
    { event, existing, sourceUrl: BLACK_FRIDAY_URL, noted: (change) => `${id}: ${change}` },
    log,
  );
  return { writes: write ? [write] : [], ...log };
}
