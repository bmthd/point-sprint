import type { OfficialEvent, Plan, Shop, SpuMonth } from "@workspaces/domain";

// The plans drawn in the help's figures: October's third marathon, with 8 orders (the last on
// hold), and the second one, whose orders use the same month's SPU caps. Taken from a plan made in
// the app, so the figures show what a real plan looks like.

/** The day the figures are drawn on: the last day of the third marathon. */
export const SAMPLE_TODAY = "2026-10-27";

export const SAMPLE_SHOPS: Shop[] = [
  {
    id: "4e150000-0000-4000-8000-000000000001",
    channel: "rakuten-ichiba",
    name: "お米の店 まるた",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000002",
    channel: "rakuten-ichiba",
    name: "お茶の葉 みどり",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000003",
    channel: "rakuten-ichiba",
    name: "ふとん工房 ねむり",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000004",
    channel: "rakuten-ichiba",
    name: "キッチン用品 ことこと",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000005",
    channel: "rakuten-ichiba",
    name: "コーヒー豆 焙煎所",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000006",
    channel: "rakuten-ichiba",
    name: "スポーツの森",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000007",
    channel: "rakuten-ichiba",
    name: "ペット用品 わんにゃ",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000008",
    channel: "rakuten-ichiba",
    name: "化粧品 はなの",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000009",
    channel: "rakuten-ichiba",
    name: "家電のミナミ",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000010",
    channel: "rakuten-ichiba",
    name: "紙と文具 よしの",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
  {
    id: "4e150000-0000-4000-8000-000000000011",
    channel: "rakuten-ichiba",
    name: "靴下のくつした屋",
    tags: [],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
];

/** The third marathon first, and saved last: the figures show it, the top page as the latest plan. */
export const SAMPLE_PLANS: Plan[] = [
  {
    id: "4e100000-0000-4000-8000-000000000001",
    name: "10月 お買い物マラソン第三弾",
    officialEventId: "marathon-2026-10-24",
    period: {
      start: "2026-10-24",
      end: "2026-10-27",
    },
    benefits: [
      {
        id: "a34813b7-479d-4081-9a07-6386d48aad50",
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        conditions: {
          dateRule: {
            type: "range",
            start: "2026-10-24",
            end: "2026-10-27",
          },
        },
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "marathon-2026-10-24",
        params: {
          tiers: [
            {
              minShops: 2,
              rate: 1,
            },
            {
              minShops: 3,
              rate: 2,
            },
            {
              minShops: 4,
              rate: 3,
            },
            {
              minShops: 5,
              rate: 4,
            },
            {
              minShops: 6,
              rate: 5,
            },
            {
              minShops: 7,
              rate: 6,
            },
            {
              minShops: 8,
              rate: 7,
            },
            {
              minShops: 9,
              rate: 8,
            },
            {
              minShops: 10,
              rate: 9,
            },
          ],
          cap: 7000,
          roundingUnit: "item",
        },
      },
      {
        id: "f3a469e6-eb15-463c-85e0-4d30b877d1d3",
        kind: "rate-bonus",
        category: "campaign",
        label: "5と0のつく日",
        imagePath: "/img/campaign/pointday.webp",
        enabled: false,
        conditions: {
          channels: ["rakuten-ichiba", "rakuten-books"],
          dateRule: {
            type: "daysOfMonth",
            days: [5, 10, 15, 20, 25, 30],
          },
        },
        amountBasis: "tax-excluded",
        capScope: "month",
        sharedKey: "pointday",
        params: {
          rate: 1,
          cap: 1000,
          roundingUnit: "item",
        },
      },
    ],
    orders: [
      {
        id: "4e160000-0000-4000-8000-000000000001",
        shopId: "4e150000-0000-4000-8000-000000000001",
        date: "2026-10-27",
        lineItems: [
          {
            name: "新米 5kg",
            unitPrice: 4980,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000001",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000002",
        shopId: "4e150000-0000-4000-8000-000000000009",
        date: "2026-10-27",
        lineItems: [
          {
            name: "電気ケトル",
            unitPrice: 12800,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000002",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000003",
        shopId: "4e150000-0000-4000-8000-000000000005",
        date: "2026-10-27",
        lineItems: [
          {
            name: "ドリップバッグ 30袋",
            unitPrice: 2980,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000003",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000004",
        shopId: "4e150000-0000-4000-8000-000000000011",
        date: "2026-10-27",
        lineItems: [
          {
            name: "ソックス 3足",
            unitPrice: 1100,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000004",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000005",
        shopId: "4e150000-0000-4000-8000-000000000004",
        date: "2026-10-27",
        lineItems: [
          {
            name: "フライパン 26cm",
            unitPrice: 6500,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000005",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000006",
        shopId: "4e150000-0000-4000-8000-000000000010",
        date: "2026-10-27",
        lineItems: [
          {
            name: "ノート 10冊",
            unitPrice: 3300,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000006",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000007",
        shopId: "4e150000-0000-4000-8000-000000000003",
        date: "2026-10-27",
        lineItems: [
          {
            name: "羽毛布団 シングル",
            unitPrice: 24800,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000007",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000008",
        shopId: "4e150000-0000-4000-8000-000000000002",
        date: "2026-10-27",
        lineItems: [
          {
            name: "煎茶 ギフト",
            unitPrice: 9800,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000008",
          },
        ],
        onHold: true,
        tags: [],
      },
    ],
    updatedAt: "2026-10-27T12:00:00.000Z",
  },
  {
    id: "4e100000-0000-4000-8000-000000000002",
    name: "10月 お買い物マラソン第二弾",
    officialEventId: "marathon-2026-10-14",
    period: {
      start: "2026-10-14",
      end: "2026-10-17",
    },
    benefits: [
      {
        id: "fc7a45a2-5bd9-49ee-a9e7-6104109bd30d",
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        conditions: {
          dateRule: {
            type: "range",
            start: "2026-10-14",
            end: "2026-10-17",
          },
        },
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "marathon-2026-10-14",
        params: {
          tiers: [
            {
              minShops: 2,
              rate: 1,
            },
            {
              minShops: 3,
              rate: 2,
            },
            {
              minShops: 4,
              rate: 3,
            },
            {
              minShops: 5,
              rate: 4,
            },
            {
              minShops: 6,
              rate: 5,
            },
            {
              minShops: 7,
              rate: 6,
            },
            {
              minShops: 8,
              rate: 7,
            },
            {
              minShops: 9,
              rate: 8,
            },
            {
              minShops: 10,
              rate: 9,
            },
          ],
          cap: 7000,
          roundingUnit: "item",
        },
      },
      {
        id: "171f88e1-407b-4c47-b3f8-7b6f0726e90c",
        kind: "rate-bonus",
        category: "campaign",
        label: "5と0のつく日",
        imagePath: "/img/campaign/pointday.webp",
        enabled: false,
        conditions: {
          channels: ["rakuten-ichiba", "rakuten-books"],
          dateRule: {
            type: "daysOfMonth",
            days: [5, 10, 15, 20, 25, 30],
          },
        },
        amountBasis: "tax-excluded",
        capScope: "month",
        sharedKey: "pointday",
        params: {
          rate: 1,
          cap: 1000,
          roundingUnit: "item",
        },
      },
    ],
    orders: [
      {
        id: "4e160000-0000-4000-8000-000000000009",
        shopId: "4e150000-0000-4000-8000-000000000006",
        date: "2026-10-17",
        lineItems: [
          {
            name: "ランニングシューズ",
            unitPrice: 16800,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000009",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000010",
        shopId: "4e150000-0000-4000-8000-000000000007",
        date: "2026-10-17",
        lineItems: [
          {
            name: "キャットフード 4kg",
            unitPrice: 8800,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000010",
          },
        ],
        onHold: false,
        tags: [],
      },
      {
        id: "4e160000-0000-4000-8000-000000000011",
        shopId: "4e150000-0000-4000-8000-000000000008",
        date: "2026-10-17",
        lineItems: [
          {
            name: "化粧水セット",
            unitPrice: 5400,
            quantity: 1,
            taxRate: 0.1,
            discount: 0,
            id: "4e170000-0000-4000-8000-000000000011",
          },
        ],
        onHold: false,
        tags: [],
      },
    ],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
];

/** October's SPU: 楽天カード（通常）, 特典分, 楽天モバイル, 楽天銀行（楽天カード引落）and 楽天ブックス. */
export const SAMPLE_SPU_MONTHS: SpuMonth[] = [
  {
    id: "acc00000-0000-4000-8000-000000000000:2026-10",
    accountId: "acc00000-0000-4000-8000-000000000000",
    month: "2026-10",
    enabledIds: [
      "c69441cb-ac51-4cf9-8ebd-a909a093907e",
      "9527dde1-c708-44fa-b2cf-5b7b35e0f3d1",
      "864f3f89-dacc-4313-a528-dac222c383cc",
      "ca794fa7-4a85-43c6-ab34-e06feb115c5d",
      "c6a1511e-c5e8-4c68-958a-4b1d5dd3ea42",
      "1933c19c-0aa3-4052-8d5e-c0d07859a0a9",
    ],
    updatedAt: "2026-10-27T00:00:00.000Z",
  },
];

/** The two marathons the sample plans were made from, as the top page lists them. */
export const SAMPLE_EVENTS: OfficialEvent[] = SAMPLE_PLANS.map((plan) => ({
  id: plan.officialEventId ?? plan.id,
  name: plan.name.replace(/^\d+月 /, ""),
  period: plan.period,
  times: { start: "20:00", end: "09:59" },
  benefits: plan.benefits,
  url: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
}));
