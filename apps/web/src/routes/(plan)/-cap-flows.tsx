// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { setInput } from "@formisch/react";
import { type Plan, capFlows } from "@workspaces/domain";
import { Button, List, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useDeferredValue, useMemo } from "react";
import { withEffectiveAccount } from "../../state/accounts";
import { accountSettingsAtom } from "../../state/derived";
import { plansAtom, shopsAtom } from "../../state/queries";
import { scopeText } from "./-cap-lines";
import { draftOfInput } from "./-order-editor/order-form";
import { AMOUNT_PATH, type OrderForm, useFormInput } from "./-order-editor/order-form-store";
import { yen } from "./-order-shared";

const num = (value: number) => value.toLocaleString("ja-JP");

/**
 * Under a new order's fields: how many of its points the order receives from each cap and how
 * many are over, with a button that types the price filling the cap. Nothing while the order is not valid, is
 * held, or goes into no cap.
 */
export function CapFlows({ plan, form }: { plan: Plan; form: OrderForm }) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const settings = useAtomValue(accountSettingsAtom);
  const key = JSON.stringify(useFormInput(form));
  // Like the preview, this may lag a keystroke behind.
  const deferred = useDeferredValue(key);
  const draft = useMemo(
    () => draftOfInput(JSON.parse(deferred), shops, undefined),
    [deferred, shops],
  );
  const flows = useMemo(() => {
    if (!draft || draft.order.onHold) return [];
    return capFlows({
      plans: plans.map((other) => withEffectiveAccount(other, settings)),
      shops: draft.shop
        ? [...shops.filter((shop) => shop.id !== draft.shop?.id), draft.shop]
        : shops,
      planId: plan.id,
      order: draft.order,
    });
  }, [draft, plans, shops, settings, plan.id]);
  if (flows.length === 0) return null;
  return (
    <List.Root as="ul" aria-label="上限への入り方" w="full" fontSize="xs" gap="1">
      {flows.map(({ line, into, over, fillPrice }) => (
        <List.Item
          key={`${line.benefit.id}:${line.key}`}
          display="flex"
          alignItems="center"
          flexWrap="wrap"
          gap="2"
        >
          <Text as="span" fontVariantNumeric="tabular-nums">
            {line.benefit.label}（{scopeText(line, undefined)}） <Text as="b">+{num(into)}P</Text>
            {over > 0 ? (
              <Text as="span" color="fg.muted">
                ・{num(over)}P はみ出す
              </Text>
            ) : null}
          </Text>
          {fillPrice !== null && fillPrice > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setInput(form, { path: AMOUNT_PATH, input: String(fillPrice) })}
            >
              {yen(fillPrice)} で使い切る
            </Button>
          ) : null}
        </List.Item>
      ))}
    </List.Root>
  );
}
