import {
  channels,
  lostSpuPurchases,
  type Plan,
  type Shop,
  planAccountId,
  spuPurchaseRules,
  standardSpu,
  toggleSpu,
} from "@workspaces/domain";
import { Button, Flex, Text, useNotice } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { withEffectiveAccount } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { saveSpuMonthAtom } from "../../../state/mutations";
import { plansAtom, shopsAtom, spuMonthsAtom } from "../../../state/queries";
import { monthText } from "../-warnings";

/**
 * Tells the user when a change to the orders (holding, deleting or editing one) leaves an SPU
 * that orders turn on (楽天ブックス、楽天Kobo) without an order of the plan's account and month that
 * meets it. The SPU stays on, since it may be met outside this app; the notice offers to turn it
 * off for the month.
 */
export function useSpuLossNotice(plan: Plan) {
  const settings = useAtomValue(accountSettingsAtom);
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const months = useAtomValue(spuMonthsAtom);
  const accountId = planAccountId(withEffectiveAccount(plan, settings));
  const notice = useNotice({ status: "warning", duration: 10000, closeStrategy: "button" });
  const { mutateAsync: saveMonth } = useAtomValue(saveSpuMonthAtom);
  const previous = useRef<{ plans: Plan[]; shops: Shop[] }>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = { plans, shops };
    if (!before) return;
    const effective = (list: Plan[]) => list.map((other) => withEffectiveAccount(other, settings));
    const lost = lostSpuPurchases({
      before: effective(before.plans),
      after: effective(plans),
      shops,
      beforeShops: before.shops,
      months,
    });
    for (const { month, benefitId } of lost.filter((one) => one.accountId === accountId)) {
      const rule = spuPurchaseRules.find((candidate) => candidate.benefitId === benefitId);
      const benefit = standardSpu.find((candidate) => candidate.id === benefitId);
      if (!rule || !benefit) continue;
      const id = `spu-lost-${month}-${benefitId}`;
      const amount = rule.minOrderAmount.toLocaleString("ja-JP");
      notice({
        id,
        title: `${monthText(month)}の SPU の${benefit.label}の対象外になるかもしれません`,
        description: (
          <Flex direction="column" gap="2" alignItems="flex-start">
            <Text>
              {channels[rule.channel].label}で {amount}
              円以上の注文がなくなりました。アプリの外で達成していなければ OFF にしてください。
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                notice.close(id);
                void saveMonth({
                  accountId,
                  month,
                  change: (ids) => (ids.has(benefitId) ? toggleSpu(ids, benefitId) : [...ids]),
                }).catch(() => notice({ status: "error", title: "変更を保存できませんでした。" }));
              }}
            >
              {benefit.label}を OFF にする
            </Button>
          </Flex>
        ),
      });
    }
  }, [plans, shops, months, settings, accountId, notice, saveMonth]);
}
