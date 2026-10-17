import { type Benefit, type OfficialEvent, OfficialEventSchema } from "@workspaces/domain";
import * as v from "valibot";
import {
  MARATHON_URL,
  SCHEDULE_URL,
  type CurrentRound,
  type ScheduledRound,
  readCurrentRound,
  readSchedule,
} from "./event-pages";

// Turns the marathon pages into rows of the event master (event-store.ts). A row is published only
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
 * The marathon round as an event: 2〜10 shops pay 2〜10倍 when `maxRate` is 10, and the shop-around
 * keeps `benefitId` across updates.
 */
export function marathonEvent(input: {
  round: ScheduledRound;
  maxRate: number;
  cap: number | undefined;
  benefitId: string;
}): OfficialEvent {
  const { round, maxRate, cap, benefitId } = input;
  const id = `marathon-${round.period.start}`;
  const shopAround: Benefit = {
    id: benefitId,
    kind: "shop-around",
    category: "campaign",
    label: "ショップ買いまわり",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "campaign",
    sharedKey: id,
    conditions: { dateRule: { type: "range", ...round.period } },
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
    name: `お買い物マラソン${round.title}`,
    period: { ...round.period },
    benefits: [shopAround],
  };
}

/** JSON with the keys of each object sorted, so two events built differently compare equal. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

const capOf = (event: OfficialEvent) => {
  const benefit = event.benefits.find((candidate) => candidate.kind === "shop-around");
  return benefit?.kind === "shop-around" ? benefit.params.cap : undefined;
};

const samePeriod = (a: ScheduledRound["period"], b: ScheduledRound["period"]) =>
  a.start === b.start && a.end === b.end;

/**
 * The rows to write for the rounds that have not ended by `today` (`YYYY-MM-DD` in Japan). A round
 * the marathon page does not show yet goes in with its period and the guide's rate, and no cap.
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
  const notes: string[] = [];
  let outcome: RunOutcome = "ok";
  const warn = (note: string) => {
    notes.push(note);
    outcome = "warning";
  };

  const rounds = readSchedule(scheduleHtml);
  if (rounds.length === 0) {
    return { writes: [], outcome: "failed", notes: ["スケジュールのページから回を読めない"] };
  }

  let current: CurrentRound | undefined;
  if ("error" in marathon) warn(`マラソンのページを取得できない（${marathon.error}）`);
  else {
    current = readCurrentRound(marathon.html);
    // Between rounds, the page says only 「終了しました」.
    if (!current) notes.push("マラソンのページに開催中・開催直前の回がない");
    else if (!current.campaignName.startsWith("お買い物マラソン")) {
      warn(`マラソンのページのキャンペーン名が「${current.campaignName}」`);
      current = undefined;
    } else if (!rounds.some((round) => samePeriod(round.period, current!.period))) {
      warn(
        `マラソンのページの期間 ${current.period.start}〜${current.period.end} がスケジュールのページにない`,
      );
      current = undefined;
    }
  }

  const writes: EventWrite[] = [];
  for (const round of rounds) {
    if (round.period.end < today) continue;
    const id = `marathon-${round.period.start}`;
    const existing = stored.get(id);
    if (existing?.locked || existing?.status === "rejected") {
      notes.push(`${id}: ${existing.locked ? "固定" : "却下"}されているので更新しない`);
      continue;
    }
    const shown = current && samePeriod(current.period, round.period) ? current : undefined;
    // The marathon page leaves at the round's end; the cap read while it showed the round stays.
    if (
      !shown &&
      existing &&
      capOf(existing.event) !== undefined &&
      samePeriod(existing.event.period, round.period)
    ) {
      continue;
    }
    const existingBenefit = existing?.event.benefits.find(
      (benefit) => benefit.kind === "shop-around",
    );
    const event = marathonEvent({
      round,
      maxRate: shown?.maxRate ?? GUIDE_MAX_RATE,
      cap: shown?.cap,
      benefitId: existingBenefit?.id ?? newId(),
    });
    const sourceUrl = shown ? MARATHON_URL : SCHEDULE_URL;
    const problems = checkEvent(event);
    if (problems.length > 0) {
      warn(`${id}: ${problems.join("、")}`);
      // The row already published stays; a new one waits for the operator.
      if (!existing) writes.push({ event, status: "pending", sourceUrl });
      continue;
    }
    if (existing?.status === "published" && canonical(existing.event) === canonical(event))
      continue;
    writes.push({ event, status: "published", sourceUrl });
    notes.push(`${id}: ${existing ? "更新" : "追加"}`);
  }
  return { writes, outcome, notes };
}
