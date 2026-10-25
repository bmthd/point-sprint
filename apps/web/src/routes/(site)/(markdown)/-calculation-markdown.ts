import {
  type Benefit,
  type BenefitSource,
  type LineItem,
  type Plan,
  SPU_PAGE,
  type Shop,
  calculate,
  campaignSources,
  campaignTemplates,
  spuSource,
  standardSpu,
  taxExcludedTarget,
} from "@workspaces/domain";
import { type Notice, latestRelease, notices, releasesOldestFirst } from "../../-notices/notices";

const yen = (amount: number) => `${amount.toLocaleString("ja-JP")}円`;
const pointsOf = (points: number) => `${points.toLocaleString("ja-JP")}P`;
const rateOf = (rate: number) => `+${rate}倍`;

/** `2026-10-04` as `2026年10月4日`. */
const longDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
};

const table = (head: string[], rows: string[][]) =>
  [head, head.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n");

// The example: one order at a shop of 楽天市場 on a day ending in 5, with the usual SPU and the card.
const SHOP_ID = "a0000000-0000-4000-8000-000000000001";
const EXAMPLE_PRICE = 5500;
const EXAMPLE_ITEM: LineItem = {
  id: "d0000000-0000-4000-8000-000000000001",
  name: "例の商品",
  unitPrice: EXAMPLE_PRICE,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
};
const EXAMPLE_LABELS = [
  "通常ポイント",
  "楽天カード通常分（カード本体の還元）",
  "楽天カード特典分（SPU）",
];

const exampleBenefits = (): Benefit[] => {
  const pointday = campaignTemplates.find((t) => t.id === "pointday")?.benefit;
  if (pointday === undefined) throw new Error("The master has no 5と0のつく日.");
  return [...standardSpu.filter((b) => EXAMPLE_LABELS.includes(b.label)), pointday].map((b) => ({
    ...b,
    enabled: true,
  }));
};

/**
 * The example of the page, worked out by the same calculation as the plans: a table of each
 * benefit's points and their total.
 */
export function exampleMarkdown(): { markdown: string; total: number } {
  const benefits = exampleBenefits();
  const shop: Shop = {
    id: SHOP_ID,
    channel: "rakuten-ichiba",
    name: "例のショップ",
    tags: [],
    updatedAt: "2026-10-01T00:00:00Z",
  };
  const plan: Plan = {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "例",
    period: { start: "2026-10-01", end: "2026-10-31" },
    benefits,
    orders: [
      {
        id: "c0000000-0000-4000-8000-000000000001",
        shopId: SHOP_ID,
        date: "2026-10-05",
        lineItems: [EXAMPLE_ITEM],
        onHold: false,
        tags: [],
      },
    ],
    updatedAt: "2026-10-01T00:00:00Z",
  };
  const result = calculate(plan, [shop]);
  const taxExcluded = taxExcludedTarget(EXAMPLE_ITEM);
  const rows = benefits.map((benefit) => {
    const total = result.benefitTotals.find((t) => t.benefitId === benefit.id);
    const rate = result.rates[benefit.id] ?? 0;
    return [
      benefit.label,
      benefit.amountBasis === "tax-included"
        ? `${yen(EXAMPLE_PRICE)}（税込）`
        : `${yen(taxExcluded)}（税抜）`,
      benefit.category === "base" ? `${rate}倍` : rateOf(rate),
      pointsOf(total?.cappedPoints ?? 0),
    ];
  });
  const markdown = [
    `10月5日（5と0のつく日）に、楽天市場のショップで税込 ${yen(EXAMPLE_PRICE)}（税率10%）の商品を1つ、楽天カードで買う例です。SPU は楽天カードだけを達成しているとします。`,
    `税抜の額は、消費税 ${yen(EXAMPLE_PRICE - taxExcluded)}（${yen(EXAMPLE_PRICE)} × 10 ÷ 110 の小数点以下を切り捨て）を引いた ${yen(taxExcluded)} です。`,
    table(
      ["特典", "対象額", "倍率", "ポイント"],
      [...rows, ["合計", "", "", pointsOf(result.total)]],
    ),
  ].join("\n\n");
  return { markdown, total: result.total };
}

const capScopeLabels: Record<Benefit["capScope"], string> = {
  month: "月",
  campaign: "開催期間",
  occurrence: "1回の開催",
  plan: "プラン",
};

const capOf = (benefit: Benefit) => {
  const cap = benefit.params.cap;
  return cap === undefined ? undefined : `${capScopeLabels[benefit.capScope]} ${pointsOf(cap)}`;
};

const ratesOf = (benefit: Benefit) => {
  switch (benefit.kind) {
    case "rate-bonus":
      return rateOf(benefit.params.rate);
    case "spend-tiers":
      return benefit.params.tiers
        .map((tier) => `${yen(tier.minAmount)}以上で${rateOf(tier.rate)}`)
        .join("、");
    case "shop-around":
      return benefit.params.tiers
        .map((tier) => `${tier.minShops}ショップで${rateOf(tier.rate)}`)
        .join("、");
  }
};

const sourceOf = (source: BenefitSource | undefined) => {
  if (source === undefined || source.kind === "user-entered") return "";
  const cited = `[${source.title}](${source.url})（${longDate(source.checkedOn)}に確認）`;
  return source.kind === "unofficial" ? `${cited}で、楽天の公式ではありません` : cited;
};

/** The SPU the calculation knows: rate and monthly cap, after the page and the days it was checked. */
export function spuTableMarkdown(): string {
  const byDay = new Map<string, Benefit[]>();
  for (const benefit of standardSpu) {
    const day = spuSource(benefit).checkedOn;
    byDay.set(day, [...(byDay.get(day) ?? []), benefit]);
  }
  const [usual, ...others] = [...byDay].toSorted(([, a], [, b]) => b.length - a.length);
  const checked = [
    usual === undefined ? "" : `${longDate(usual[0])}に確かめました`,
    ...others.map(([day, list]) => `${list.map((b) => b.label).join("と")}は${longDate(day)}`),
  ].join("。");
  return [
    `出典はどれも[${SPU_PAGE.title}](${SPU_PAGE.url})で、${checked}。`,
    table(
      ["項目", "倍率", "上限"],
      standardSpu.map((benefit) => [
        benefit.label,
        benefit.category === "base" ? ratesOf(benefit).slice(1) : ratesOf(benefit),
        capOf(benefit) ?? "なし",
      ]),
    ),
  ].join("\n\n");
}

/**
 * The campaigns whose rates come from Rakuten, with their sources: a list, since a source with its
 * day does not fit a table's cell on a phone.
 */
export function campaignListMarkdown(): string {
  return campaignTemplates
    .filter((template) => campaignSources[template.id]?.kind !== "user-entered")
    .map((template) => {
      const cap = capOf(template.benefit);
      return `- ${template.name}: ${ratesOf(template.benefit)}、${cap === undefined ? "上限なし" : `上限は${cap}`}。出典は${sourceOf(campaignSources[template.id])}`;
    })
    .join("\n");
}

const releaseLink = (notice: Notice & { release: { version: string } }) =>
  `[Ver.${notice.release.version}](/notices#${notice.id})（${longDate(notice.date)}）`;

/** The version the page describes, and the last one that changed the calculation. */
export function releaseMarkdown(list: readonly Notice[] = notices): string {
  const latest = latestRelease(list);
  if (latest === undefined) return "";
  const lastChange = releasesOldestFirst(list).findLast((n) => n.release.changesCalculation);
  return [
    `このページは ${releaseLink(latest)} の計算方法です。`,
    lastChange === undefined
      ? "Ver.1.0 から、計算の結果が変わる変更はありません。"
      : `計算の結果が最後に変わったのは ${releaseLink(lastChange)} です。`,
    "これまでの変更は[お知らせ](/notices)に載せています。",
  ].join("");
}

/** The page's Markdown with its tables and example filled in from the calculation's data. */
export function calculationMarkdown(template: string): string {
  const parts: Record<string, () => string> = {
    example: () => exampleMarkdown().markdown,
    "spu-table": spuTableMarkdown,
    "campaign-list": campaignListMarkdown,
    release: () => releaseMarkdown(),
  };
  return template.replace(/^\{\{([a-z-]+)\}\}$/gm, (line, name: string) => {
    const part = parts[name];
    if (part === undefined) throw new Error(`calculation.md has an unknown placeholder: ${line}`);
    return part();
  });
}
