import {
  type Benefit,
  type BenefitSource,
  type LineItem,
  type Order,
  type Plan,
  SHOP_AROUND_MIN_AMOUNT,
  SPU_PAGE,
  type Shop,
  calculate,
  calculateAll,
  campaignSources,
  campaignTemplates,
  countShops,
  spuSource,
  standardSpu,
  taxExcludedTarget,
  taxIncludedTarget,
} from "@workspaces/domain";
import { type Notice, latestRelease, notices, releasesOldestFirst } from "../../-notices/notices";

const yen = (amount: number) => `${amount.toLocaleString("ja-JP")}円`;
const pointsOf = (points: number) => `${points.toLocaleString("ja-JP")}P`;
const rateOf = (rate: number) => `+${rate}倍`;
/** A rate as the share of the amount it gives: 1倍 is 1%. */
const percentOf = (rate: number) => `${rate}%`;

/** `2026-10-04` as `2026年10月4日`. */
const longDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
};

/** `2026-10-04` as `10月4日`. */
const monthDay = (date: string) => {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
};

const table = (head: string[], rows: string[][]) =>
  [head, head.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n");

/** `:::name argument` around a table. */
const figure = (name: string, head: string[], rows: string[][], argument = "") =>
  [`:::${name}${argument ? ` ${argument}` : ""}`, table(head, rows), ":::"].join("\n\n");

const PERIOD = { start: "2026-10-01", end: "2026-10-31" };
const UPDATED_AT = "2026-10-01T00:00:00Z";

const shopOf = (id: string, name: string, channel: Shop["channel"] = "rakuten-ichiba"): Shop => ({
  id,
  channel,
  name,
  tags: [],
  updatedAt: UPDATED_AT,
});

const itemOf = (id: string, unitPrice: number): LineItem => ({
  id,
  name: "例の商品",
  unitPrice,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
});

const orderOf = (id: string, shopId: string, date: string, items: LineItem[]): Order => ({
  id,
  shopId,
  date,
  lineItems: items,
  onHold: false,
  tags: [],
});

const planOf = (id: string, name: string, benefits: Benefit[], orders: Order[]): Plan => ({
  id,
  name,
  period: PERIOD,
  benefits,
  orders,
  updatedAt: UPDATED_AT,
});

const spuNamed = (label: string) => {
  const benefit = standardSpu.find((b) => b.label === label);
  if (benefit === undefined) throw new Error(`The master has no SPU named ${label}.`);
  return { ...benefit, enabled: true };
};

const CARD_BASE = "楽天カード通常分（カード本体の還元）";
const CARD_SPU = "楽天カード特典分（SPU）";

// The example: one item at a shop of 楽天市場 on a day ending in 5, with the usual SPU and the card.
const EXAMPLE_SHOP = shopOf("a0000000-0000-4000-8000-000000000001", "例のショップ");
const EXAMPLE_ITEM = itemOf("d0000000-0000-4000-8000-000000000001", 5500);

const exampleBenefits = (): Benefit[] => {
  const pointday = campaignTemplates.find((t) => t.id === "pointday")?.benefit;
  if (pointday === undefined) throw new Error("The master has no 5と0のつく日.");
  return [
    spuNamed("通常ポイント"),
    spuNamed(CARD_BASE),
    spuNamed(CARD_SPU),
    { ...pointday, enabled: true },
  ];
};

/** The example worked out by the same calculation as the plans. */
export function workedExample() {
  const benefits = exampleBenefits();
  const plan = planOf("b0000000-0000-4000-8000-000000000001", "例", benefits, [
    orderOf("c0000000-0000-4000-8000-000000000001", EXAMPLE_SHOP.id, "2026-10-05", [EXAMPLE_ITEM]),
  ]);
  const result = calculate(plan, [EXAMPLE_SHOP]);
  const price = EXAMPLE_ITEM.unitPrice;
  const taxExcluded = taxExcludedTarget(EXAMPLE_ITEM);
  const rows = benefits.map((benefit) => ({
    benefit,
    base: benefit.amountBasis === "tax-included" ? price : taxExcluded,
    rate: result.rates[benefit.id] ?? 0,
    points: result.benefitTotals.find((t) => t.benefitId === benefit.id)?.cappedPoints ?? 0,
  }));
  return { price, taxExcluded, tax: price - taxExcluded, rows, total: result.total };
}

const basisOf = (benefit: Benefit) => (benefit.amountBasis === "tax-included" ? "税込" : "税抜");

/** Each benefit's points in the example, and their total. */
export function exampleMarkdown(): string {
  const { rows, total } = workedExample();
  return figure(
    "breakdown",
    ["特典", "計算", "ポイント"],
    rows.map(({ benefit, base, rate, points }) => [
      benefit.label,
      `${basisOf(benefit)} ${yen(base)} × ${percentOf(rate)}`,
      pointsOf(points),
    ]),
    `合計 ${pointsOf(total)}`,
  );
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

/** The card's two parts side by side: what each is on, its rate, its cap and its points. */
export function cardSplitMarkdown(): string {
  const { rows } = workedExample();
  const parts = [CARD_BASE, CARD_SPU].map((label) => {
    const row = rows.find((r) => r.benefit.label === label);
    if (row === undefined) throw new Error(`The example has no ${label}.`);
    return row;
  });
  return figure(
    "compare",
    ["", "通常分（カード本体の還元）", "特典分（SPU）"],
    [
      ["対象", ...parts.map(({ benefit, base }) => `${basisOf(benefit)}の額 ${yen(base)}`)],
      ["倍率", ...parts.map(({ rate }) => percentOf(rate))],
      ["上限", ...parts.map(({ benefit }) => capOf(benefit) ?? "なし")],
      ["ポイント", ...parts.map(({ points }) => pointsOf(points))],
    ],
  );
}

/**
 * Two plans of one month that both use the card's SPU, worked out together: past the monthly cap,
 * the cap is shared between them in proportion to what each would get.
 */
export function capSharingMarkdown(): string {
  const spu = spuNamed(CARD_SPU);
  const shop = shopOf("a0000000-0000-4000-8000-000000000002", "例のショップ");
  const plans = [
    { name: "プランA", price: 77000 },
    { name: "プランB", price: 49500 },
  ].map(({ name, price }, index) => {
    const item = itemOf(`d0000000-0000-4000-8000-00000000001${index}`, price);
    const plan = planOf(
      `b0000000-0000-4000-8000-00000000001${index}`,
      name,
      [spu],
      [orderOf(`c0000000-0000-4000-8000-00000000001${index}`, shop.id, "2026-10-12", [item])],
    );
    return { plan, taxExcluded: taxExcludedTarget(item) };
  });
  const results = calculateAll(
    plans.map(({ plan }) => plan),
    [shop],
  );
  const totals = plans.map(({ plan, taxExcluded }) => {
    const total = results.get(plan.id)?.benefitTotals.find((t) => t.benefitId === spu.id);
    if (total === undefined) throw new Error(`No total for ${plan.name}.`);
    return { name: plan.name, taxExcluded, raw: total.rawPoints, capped: total.cappedPoints };
  });
  const raw = totals.reduce((sum, t) => sum + t.raw, 0);
  const cap = spu.params.cap ?? 0;
  return [
    `10月の2つのプランで、楽天カードの特典分（${capOf(spu)}）を使う例です。`,
    figure(
      "meter",
      ["プラン", "ポイント"],
      totals.map((t) => [
        `${t.name}（税抜 ${yen(t.taxExcluded)}、上限がなければ ${pointsOf(t.raw)}）`,
        pointsOf(t.capped),
      ]),
      `上限 ${pointsOf(cap)}`,
    ),
    raw > cap
      ? `2つを合わせると ${pointsOf(raw)} で上限を超えるので、上限の ${pointsOf(cap)} を、上限がないときのポイントの比で分けます。`
      : "",
  ].join("\n\n");
}

/**
 * Shops counted toward 買いまわり in an example: a shop counts once its orders of the period add
 * up to the minimum, however many they are.
 */
export function shopCountMarkdown(): string {
  const shops = [
    { shop: shopOf("a0000000-0000-4000-8000-000000000021", "ショップA"), prices: [1980, 1320] },
    {
      shop: shopOf("a0000000-0000-4000-8000-000000000022", "楽天ブックス", "rakuten-books"),
      prices: [1320],
    },
    { shop: shopOf("a0000000-0000-4000-8000-000000000023", "ショップB"), prices: [880] },
  ];
  const orders = shops.flatMap(({ shop, prices }, at) =>
    prices.map((price, index) =>
      orderOf(`c0000000-0000-4000-8000-0000000002${at}${index}`, shop.id, `2026-10-2${index + 4}`, [
        itemOf(`d0000000-0000-4000-8000-0000000002${at}${index}`, price),
      ]),
    ),
  );
  const count = countShops(
    orders,
    shops.map(({ shop }) => shop),
    PERIOD,
  );
  const rows = shops.map(({ shop, prices }) => {
    const sum = orders
      .filter((order) => "shopId" in order && order.shopId === shop.id)
      .flatMap((order) => order.lineItems)
      .reduce((total, item) => total + taxIncludedTarget(item), 0);
    return [
      shop.name,
      sum >= SHOP_AROUND_MIN_AMOUNT ? "1店舗" : "数えない",
      prices.length > 1 ? `${yen(sum)}（${prices.length}回の注文）` : yen(sum),
    ];
  });
  return [
    figure("cards", ["ショップ", "数え方", "期間中の合計"], rows),
    `この例の買いまわりは ${count}店舗 です。`,
  ].join("\n\n");
}

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

/** The largest rate a benefit gives, `最大` before it when it has steps. */
const topRateOf = (benefit: Benefit) => {
  if (benefit.kind === "rate-bonus") return rateOf(benefit.params.rate);
  const { tiers } = benefit.params;
  const top = Math.max(...tiers.map((tier) => tier.rate));
  return tiers.length > 1 ? `最大 ${rateOf(top)}` : rateOf(top);
};

const sourceOf = (source: BenefitSource | undefined) => {
  if (source === undefined || source.kind === "user-entered") return "";
  const cited = `[${source.title}](${source.url})、${monthDay(source.checkedOn)}に確認`;
  return source.kind === "unofficial" ? `${cited}（楽天の公式ではありません）` : cited;
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

/** The campaigns whose rates come from Rakuten, each a card with its source. */
export function campaignListMarkdown(): string {
  return figure(
    "cards",
    ["キャンペーン", "倍率", "段階", "上限", "出典"],
    campaignTemplates
      .filter((template) => campaignSources[template.id]?.kind !== "user-entered")
      .map(({ id, name, benefit }) => [
        name,
        topRateOf(benefit),
        benefit.kind === "rate-bonus" ? "" : ratesOf(benefit),
        capOf(benefit) ?? "なし",
        sourceOf(campaignSources[id]),
      ]),
  );
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

/** The page's Markdown with its figures and numbers filled in from the calculation's data. */
export function calculationMarkdown(template: string): string {
  const example = workedExample();
  const parts: Record<string, () => string> = {
    price: () => yen(example.price),
    "tax-excluded": () => yen(example.taxExcluded),
    tax: () => yen(example.tax),
    total: () => pointsOf(example.total),
    example: exampleMarkdown,
    "card-split": cardSplitMarkdown,
    "cap-sharing": capSharingMarkdown,
    "shop-count": shopCountMarkdown,
    "spu-table": spuTableMarkdown,
    "campaign-list": campaignListMarkdown,
    release: () => releaseMarkdown(),
  };
  return template.replace(/\{\{([a-z-]+)\}\}/g, (placeholder, name: string) => {
    const part = parts[name];
    if (part === undefined)
      throw new Error(`calculation.md has an unknown placeholder: ${placeholder}`);
    return part();
  });
}
