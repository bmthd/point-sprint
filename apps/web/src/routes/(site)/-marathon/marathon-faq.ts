import type { OfficialEvent } from "@workspaces/domain";
import { grouped } from "#/ui/format.ts";
import { siteUrl } from "#/site-url.ts";
import {
  capReachingSpend,
  datedPeriod,
  marathonHeading,
  shopAroundOf,
  splitRounds,
} from "./marathon-rounds";

// The questions people search for about the marathon, answered from the rounds in the event
// master. The page shows them and marks them up from this one list, so the two never disagree.

export type FaqItem = { question: string; answer: string };

const capScope =
  "上限がかかるのは買いまわりの特典の分だけで、通常ポイントの1倍やSPUの分は含まれません。";

function whenAnswer(ahead: OfficialEvent[], past: OfficialEvent[], today: string): string {
  const [first, second] = ahead;
  if (first === undefined) {
    const last = past[0];
    return (
      "次のお買い物マラソンは、まだ発表されていません。楽天が告知すると、このページに日程が出ます。" +
      (last ? `前の回は${last.name}で、${datedPeriod(last)}でした。` : "")
    );
  }
  if (first.period.start > today) return `次のお買い物マラソンは、${datedPeriod(first)}です。`;
  return (
    `いまは${first.name}が開催中です。期間は${datedPeriod(first)}です。` +
    (second
      ? `次は${second.name}で、${datedPeriod(second)}です。`
      : "次の回は、まだ発表されていません。")
  );
}

/** The fewest shops that raise the rate, and the rate there, without the normal 1倍. */
function lowestTier(round: OfficialEvent) {
  const benefit = round.benefits.find((b) => b.kind === "shop-around");
  if (benefit?.kind !== "shop-around") return undefined;
  return [...benefit.params.tiers].sort((a, b) => a.minShops - b.minShops)[0];
}

/**
 * The questions and answers of `/marathon`, from the round running or coming, falling back on the
 * latest round whose cap is known. A question that no round answers is left out.
 */
export function marathonFaq(rounds: OfficialEvent[], today: string): FaqItem[] {
  const { ahead, past } = splitRounds(rounds, today);
  const target = ahead[0];
  const known = past.find((round) => shopAroundOf(round)?.cap !== undefined);
  const capped = target !== undefined && shopAroundOf(target)?.cap !== undefined ? target : known;

  const faq: FaqItem[] = [
    { question: "次のお買い物マラソンはいつ？", answer: whenAnswer(ahead, past, today) },
  ];
  const cappedShopAround = capped && shopAroundOf(capped);
  if (capped && cappedShopAround?.cap !== undefined) {
    const cap = `${grouped(cappedShopAround.cap)}ポイント`;
    faq.push({
      question: "お買い物マラソンのポイント上限はいくら？",
      answer:
        (capped === target
          ? `${capped.name}の獲得上限は${cap}です。`
          : `${target ? target.name : "次の回"}の獲得上限は、まだ発表されていません。前の回（${capped.name}）は${cap}でした。`) +
        capScope,
    });
    const spend = capReachingSpend(cappedShopAround);
    if (spend !== undefined) {
      faq.push({
        question: "上限までポイントをもらうには、いくら買えばいい？",
        answer:
          `${cappedShopAround.maxShops}ショップで買って倍率を最大の${cappedShopAround.maxRate + 1}倍にしたとき、` +
          `上限の${cap}に届くのは税抜${grouped(spend)}円の買い物です（${capped.name}の条件）。` +
          "ショップが少ないと、届く金額は大きくなります。",
      });
    }
  }
  const ruled = target ?? capped;
  const rule = ruled && shopAroundOf(ruled);
  const lowest = ruled && lowestTier(ruled);
  if (rule && lowest) {
    faq.push({
      question: "買いまわりの倍率はどう決まる？",
      answer:
        `1ショップで税込1,000円以上買うと1店舗と数え、${lowest.minShops}ショップで${lowest.rate + 1}倍、` +
        `${rule.maxShops}ショップで最大${rule.maxRate + 1}倍になります。倍率は通常ポイントの1倍を含みます。` +
        `${rule.maxShops + 1}ショップ目からは増えません。`,
    });
  }
  faq.push({
    question: "お買い物マラソンにエントリーは必要？",
    answer:
      "必要です。エントリーは開催の2日前ごろから始まり、期間中にエントリーすれば、エントリーより前の購入も対象になります。",
  });
  return faq;
}

/**
 * The FAQ as JSON-LD, for a `<script type="application/ld+json">`. `<` is escaped, so a name read
 * from Rakuten's pages cannot end the script.
 */
export function marathonJsonLd(faq: FaqItem[], checkedAt: string | undefined): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${siteUrl}/marathon`,
    name: marathonHeading,
    ...(checkedAt === undefined ? {} : { dateModified: checkedAt }),
    mainEntity: faq.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }).replaceAll("<", "\\u003c");
}
