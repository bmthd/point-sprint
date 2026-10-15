import {
  channels,
  lostSpuPurchases,
  type Plan,
  type Shop,
  spuPurchaseRules,
} from "@workspaces/domain";
import { Button, Flex, Text, useNotice } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { updateBenefitAtom } from "../../../state/order-ops";
import { shopsAtom } from "../../../state/queries";

/**
 * Tells the user when a change to the plan's orders (holding, deleting or editing one) leaves an
 * SPU that orders turn on (楽天ブックス、楽天Kobo) without an order that meets it. The SPU stays
 * on, since it may be met outside this app; the notice offers to turn it off.
 */
export function useSpuLossNotice(plan: Plan) {
  const shops = useAtomValue(shopsAtom);
  const notice = useNotice({ status: "warning", duration: 10000, closeStrategy: "button" });
  const update = useSetAtom(updateBenefitAtom);
  const previous = useRef<{ plan: Plan; shops: Shop[] }>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = { plan, shops };
    if (!before || before.plan.id !== plan.id) return;
    for (const benefitId of lostSpuPurchases(before.plan, plan, shops, before.shops)) {
      const rule = spuPurchaseRules.find((candidate) => candidate.benefitId === benefitId);
      const benefit = plan.benefits.find((candidate) => candidate.id === benefitId);
      if (!rule || !benefit) continue;
      const id = `spu-lost-${benefitId}`;
      const amount = rule.minOrderAmount.toLocaleString("ja-JP");
      notice({
        id,
        title: `SPU の${benefit.label}の対象外になるかもしれません`,
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
                void update({
                  planId: plan.id,
                  benefitId,
                  change: (current) => ({ ...current, enabled: false }),
                }).catch(() => notice({ status: "error", title: "変更を保存できませんでした。" }));
              }}
            >
              {benefit.label}を OFF にする
            </Button>
          </Flex>
        ),
      });
    }
  }, [plan, shops, notice, update]);
}
