type Spu = {
  id: string;
  name: string;
  rate: number;
  max: number;
  inTax: boolean;
  url: string;
  image: string;
};

export const SPU_DEF: Spu[] = [
  {
    id: "card_common",
    name: "カード共通",
    rate: 1,
    max: Number.POSITIVE_INFINITY,
    inTax: true,
    url: "https://hb.afl.rakuten.co.jp/hgc/3299d9f8.93ec5e07.3299d9f9.4281186d/?pc=https%3A%2F%2Fwww.rakuten-card.co.jp%2Fcampaign%2Frakuten-card%2Fpoint-up%2F&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_card.png",
  },
  {
    id: "card",
    name: "カード通常",
    rate: 1,
    max: 1000,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/3299d9f8.93ec5e07.3299d9f9.4281186d/?pc=https%3A%2F%2Fwww.rakuten-card.co.jp%2Fcampaign%2Frakuten-card%2Fpoint-up%2F&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_card.png",
  },
  {
    id: "card_premium",
    name: "プレミアム カード",
    rate: 1,
    max: 5000,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/3299d9f8.93ec5e07.3299d9f9.4281186d/?pc=https%3A%2F%2Fwww.rakuten-card.co.jp%2Fcampaign%2Fpremium_card%2Fpoint-up%2F%3Fscid%3Deveryday_premiumcard&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_card_premium.png",
  },
  {
    id: "bank",
    name: "カード+銀行",
    rate: 0.3,
    max: 1000,
    inTax: false,
    url: "https://www.rakuten-bank.co.jp/campaign/spu/?scid=wi_ich_spu_spusubtab",
    image: "/img/spu/service_bank.png",
  },
  {
    id: "bank-salary",
    name: "銀行(給与)",
    rate: 0.5,
    max: 1000,
    inTax: false,
    url: "https://www.rakuten-bank.co.jp/campaign/spu/?scid=wi_ich_spu_spusubtab",
    image: "/img/spu/service_bank.png",
  },
  {
    id: "mobile",
    name: "モバイル",
    rate: 4,
    max: 2000,
    inTax: false,
    url: "https://network.mobile.rakuten.co.jp/campaign/spu/",
    image: "/img/spu/service_mobile_v2.png",
  },
  {
    id: "carrier",
    name: "キャリア決済",
    rate: 2,
    max: 1000,
    inTax: false,
    url: "https://network.mobile.rakuten.co.jp/campaign/spu/payment/?scid=wi_ich_spu_subpage_payment",
    image: "/img/spu/service_mobile_carrier_billing.png",
  },
  {
    id: "hikari",
    name: "Turbo/ひかり",
    rate: 2,
    max: 1000,
    inTax: false,
    url: "https://network.mobile.rakuten.co.jp/hikari/campaign/spu/?scid=wi_ich_spu_subpage_rhk",
    image: "/img/spu/service_turbo_hikari.svg",
  },
  // {
  //   id: 'app',
  //   name: 'アプリ経由',
  //   checked: false,
  //   rate: 0.5,
  //   max: 15000,
  //   inTax: false,
  //   url: 'https://hb.afl.rakuten.co.jp/hgc/14c23a4e.c4aad9d5.14c23a4f.15d8cec2/?pc=https%3A%2F%2Fevent.rakuten.co.jp%2Fcampaign%2Fpoint-up%2Fapp%2Falways%2F%3Fl-id%3Dpc_gnavi_top_app_spu&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9',
  //   image: '/img/spu/service_app.png',
  // },
  {
    id: "books",
    name: "ブックス",
    rate: 0.5,
    max: 500,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/14d048d1.16cdc21e.14d048d2.17f4dffd/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Fevent%2Fcampaign%2Fpointup-program%2F%3Fscid%3Dwi_ich_special_all_spu_link01a&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_books.png",
  },
  {
    id: "kobo",
    name: "Kobo",
    rate: 0.5,
    max: 500,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/329a0a78.f72c32f4.329a0a79.ef046826/?pc=https%3A%2F%2Fbooks.rakuten.co.jp%2Fevent%2Fe-book%2Fspu%2F%3Fscid%3Dwi_ich_special_kobo_spu_02&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_kobo.png",
  },
  {
    id: "rba_app",
    name: "Fashion",
    rate: 0.5,
    max: 1000,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/329a0d54.6f252b4a.329a0d55.afaa85c0/?pc=https%3A%2F%2Fbrandavenue.rakuten.co.jp%2Fguide%2Fspu%2F%3Fscid%3Dbrn_spu_main&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_rba_app.png",
  },
  {
    id: "pasha",
    name: "Pasha",
    rate: 0.5,
    max: 1000,
    inTax: false,
    url: "https://pasha.rakuten.co.jp/special/campaign/spu/?ref=spugadget_pasha_pc",
    image: "/img/spu/service_pasha.png",
  },
  {
    id: "securities",
    name: "投資信託",
    rate: 0.5,
    max: 2000,
    inTax: false,
    url: "https://www.rakuten-sec.co.jp/web/campaign/spu/?scid=wi_ich_spu_spusubtab_pc&scid=su_14085",
    image: "/img/spu/service_securities.png",
  },
  {
    id: "securities_us",
    name: "米国株式",
    rate: 0.5,
    max: 2000,
    inTax: false,
    url: "https://www.rakuten-sec.co.jp/web/campaign/spu/?scid=wi_ich_spu_spusubtab_pc&scid=su_14085",
    image: "/img/spu/service_securities_us.png",
  },
  {
    id: "wallet_red",
    name: "暗号資産",
    rate: 0.5,
    max: 1000,
    inTax: false,
    url: "https://www.rakuten-wallet.co.jp/lp/spu/?scid=wi_ich_spu_sp",
    image: "/img/spu/service_wallet_red.png",
  },
  {
    id: "travel",
    name: "トラベル",
    rate: 1,
    max: 1000,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/329a0c44.2e1bfa06.329a0c45.42ff7979/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2Fcamp%2Fspu%2F%3Fscid%3Dwi_trv_spu_tlb_pc&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_travel.png",
  },
  {
    id: "beauty",
    name: "ビューティ",
    rate: 0.5,
    max: 1000,
    inTax: false,
    url: "https://hb.afl.rakuten.co.jp/hgc/329a0dea.78ba5b55.329a0deb.a6bcb587/?pc=https%3A%2F%2Fbeauty.rakuten.co.jp%2Fcnt%2Ftopics%2Fcampaign%2Fspu%2F%3Fscid%3Dwi_ich_spu_tab_pc&link_type=hybrid_url&ut=eyJwYWdlIjoidXJsIiwidHlwZSI6Imh5YnJpZF91cmwiLCJjb2wiOjF9",
    image: "/img/spu/service_beauty.png",
  },
];
