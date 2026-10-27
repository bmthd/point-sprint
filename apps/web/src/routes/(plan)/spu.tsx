import { createFileRoute } from "@tanstack/react-router";
import { MonthSchema } from "@workspaces/domain";
import * as v from "valibot";
import { SpuPage } from "./-spu-page";
import { pageHead } from "../../page-head";

/** `month` is the month shown (`YYYY-MM`), this month when left out; `account` the account's id. */
const SpuSearchSchema = v.object({
  month: v.fallback(v.optional(MonthSchema), undefined),
  account: v.optional(v.string()),
});

export const Route = createFileRoute("/(plan)/spu")({
  head: () =>
    pageHead({
      path: "/spu",
      title: "月ごとの SPU",
      description:
        "楽天のサービスの利用で上がるポイント倍率（SPU）を、月ごとに設定します。すべてのプランの計算に使います。",
      noindex: true,
    }),
  validateSearch: SpuSearchSchema,
  component: SpuRoute,
});

function SpuRoute() {
  const { month, account } = Route.useSearch();
  return <SpuPage month={month} account={account} />;
}
