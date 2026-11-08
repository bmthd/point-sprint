import type { OfficialEvent } from "@workspaces/domain";
import { expect, test } from "vitest";
import { marathonFaq, marathonJsonLd } from "./marathon-faq.ts";

const round = (
  start: string,
  end: string,
  name: string,
  cap: number | undefined,
): OfficialEvent => {
  const id = `marathon-${start}`;
  const period = { start, end };
  return {
    id,
    name,
    period,
    times: { start: "20:00", end: "01:59" },
    benefits: [
      {
        id: `${id}-benefit`,
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: id,
        conditions: { dateRule: { type: "range", ...period } },
        params: {
          tiers: Array.from({ length: 9 }, (_, i) => ({ minShops: i + 2, rate: i + 1 })),
          cap,
          roundingUnit: "item",
        },
      },
    ],
  };
};

const third = round("2026-10-24", "2026-10-27", "お買い物マラソン第三弾", 7000);
const november = round("2026-11-04", "2026-11-11", "お買い物マラソン&ジャンル祭", 7000);
const december = round("2026-12-04", "2026-12-11", "お買い物マラソン", undefined);

const answerTo = (faq: { question: string; answer: string }[], words: string) =>
  faq.find((item) => item.question.includes(words))?.answer;

test("while a round runs, says until when, and that the next is not announced yet", () => {
  const faq = marathonFaq([third, november], "2026-11-07");
  expect(answerTo(faq, "いつ")).toBe(
    "いまはお買い物マラソン&ジャンル祭が開催中です。期間は2026年11月4日（水）20:00〜11月11日（水）1:59です。次の回は、まだ発表されていません。",
  );
});

test("names the next round when it has been announced", () => {
  expect(answerTo(marathonFaq([november, december], "2026-11-07"), "いつ")).toBe(
    "いまはお買い物マラソン&ジャンル祭が開催中です。期間は2026年11月4日（水）20:00〜11月11日（水）1:59です。次はお買い物マラソンで、2026年12月4日（金）20:00〜12月11日（金）1:59です。",
  );
  expect(answerTo(marathonFaq([november, december], "2026-11-20"), "いつ")).toBe(
    "次のお買い物マラソンは、2026年12月4日（金）20:00〜12月11日（金）1:59です。",
  );
});

test("without a round ahead, says none is announced and when the last one was", () => {
  expect(answerTo(marathonFaq([third, november], "2026-11-20"), "いつ")).toBe(
    "次のお買い物マラソンは、まだ発表されていません。楽天が告知すると、このページに日程が出ます。前の回はお買い物マラソン&ジャンル祭で、2026年11月4日（水）20:00〜11月11日（水）1:59でした。",
  );
});

test("gives the cap of the round running or coming, and what it spans", () => {
  expect(answerTo(marathonFaq([november], "2026-11-07"), "上限はいくら")).toBe(
    "お買い物マラソン&ジャンル祭の獲得上限は7,000ポイントです。上限がかかるのは買いまわりの特典の分だけで、通常ポイントの1倍やSPUの分は含まれません。",
  );
});

test("while the coming round's cap is not out, gives the last known one", () => {
  expect(answerTo(marathonFaq([november, december], "2026-11-20"), "上限はいくら")).toBe(
    "お買い物マラソンの獲得上限は、まだ発表されていません。前の回（お買い物マラソン&ジャンル祭）は7,000ポイントでした。上限がかかるのは買いまわりの特典の分だけで、通常ポイントの1倍やSPUの分は含まれません。",
  );
  expect(answerTo(marathonFaq([november], "2026-11-20"), "上限はいくら")).toBe(
    "次の回の獲得上限は、まだ発表されていません。前の回（お買い物マラソン&ジャンル祭）は7,000ポイントでした。上限がかかるのは買いまわりの特典の分だけで、通常ポイントの1倍やSPUの分は含まれません。",
  );
});

test("gives the spend that fills the known cap, and the rule of the rate", () => {
  const faq = marathonFaq([november, december], "2026-11-20");
  expect(answerTo(faq, "いくら買えば")).toBe(
    "10ショップで買って倍率を最大の10倍にしたとき、上限の7,000ポイントに届くのは税抜77,778円の買い物です（お買い物マラソン&ジャンル祭の条件）。ショップが少ないと、届く金額は大きくなります。",
  );
  expect(answerTo(faq, "倍率")).toBe(
    "1ショップで税込1,000円以上買うと1店舗と数え、2ショップで2倍、10ショップで最大10倍になります。倍率は通常ポイントの1倍を含みます。11ショップ目からは増えません。",
  );
});

test("leaves out what no round tells", () => {
  const faq = marathonFaq([], "2026-11-20");
  expect(faq.map((item) => item.question)).toEqual([
    "次のお買い物マラソンはいつ？",
    "お買い物マラソンにエントリーは必要？",
  ]);
});

test("marks up the same questions and answers as a FAQ page, updated when last checked", () => {
  const faq = marathonFaq([november], "2026-11-07");
  const jsonLd = marathonJsonLd(faq, "2026-11-07T07:05:00.000Z");
  expect(JSON.parse(jsonLd)).toEqual({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: "https://point-sprint.bmth.dev/marathon",
    name: "お買い物マラソンの日程と上限",
    dateModified: "2026-11-07T07:05:00.000Z",
    mainEntity: faq.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });
  expect(JSON.parse(marathonJsonLd(faq, undefined))).not.toHaveProperty("dateModified");
});

test("cannot end the script it is written in", () => {
  const jsonLd = marathonJsonLd([{ question: "</script><b>", answer: "a" }], undefined);
  expect(jsonLd).not.toContain("</");
  expect(JSON.parse(jsonLd).mainEntity[0].name).toBe("</script><b>");
});
