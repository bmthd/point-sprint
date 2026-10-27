// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { focus, reset, useForm } from "@formisch/react";
import { type Plan, calculateAll } from "@workspaces/domain";
import { Collapse, Flex, Button, List, Text } from "@workspaces/ui";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type KeyboardEvent, useDeferredValue, useId, useMemo, useState } from "react";
import { pointsText } from "../../../ui/format";
import { Form } from "../../-form";
import { asCalculatedAtom, calculationAtom } from "../../../state/derived";
import { plansAtom, shopsAtom } from "../../../state/queries";
import { openOrderIdAtom } from "../-ui";
import { useSingleFlight } from "../../../use-single-flight";
import {
  OrderFormSchema,
  type OrderFormOutput,
  draftOf,
  draftOfInput,
  emptyInput,
} from "../-order-form";
import { type OrderForm, useFormInput, useOrderAutofill } from "../-order-form-store";
import { ChevronIcon, PlusIcon } from "../../../ui/icons";
import { orderSaveFailedAtom, useSaveOrderDraft } from "../-order-shared";
import { ACTION_BUTTON_WIDTH, OrderFormFields } from "./order-form-fields";
import { CapFlows } from "../-cap-flows";

const sumOfTotals = (results: Map<string, { total: number }>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

/** 「この注文で（5店舗目） 約 +120P」 while the form is valid. */
function AddedPointsEstimate({ plan, form }: { plan: Plan; form: OrderForm }) {
  const plans = useAtomValue(plansAtom);
  const shops = useAtomValue(shopsAtom);
  const before = useAtomValue(calculationAtom);
  const asCalculated = useAtomValue(asCalculatedAtom);
  const key = JSON.stringify(useFormInput(form));
  // Calculating every plan again is the heavy part, so it may lag a keystroke behind.
  const deferred = useDeferredValue(key);
  const preview = useMemo(() => {
    const draft = draftOfInput(JSON.parse(deferred), shops, undefined);
    if (!draft) return undefined;
    const withShop = draft.shop
      ? [...shops.filter((shop) => shop.id !== draft.shop?.id), draft.shop]
      : shops;
    const withOrder = plans.map((other) =>
      other.id === plan.id ? { ...other, orders: [...other.orders, draft.order] } : other,
    );
    const after = calculateAll(asCalculated(withOrder), withShop);
    const shopCountBefore = before.get(plan.id)?.shopCount ?? 0;
    const shopCountAfter = after.get(plan.id)?.shopCount ?? 0;
    return {
      points: sumOfTotals(after) - sumOfTotals(before),
      shop: shopCountAfter > shopCountBefore ? shopCountAfter : undefined,
    };
  }, [deferred, plans, shops, before, asCalculated, plan.id]);

  return (
    <Text
      as="span"
      flex="1"
      minW="200px"
      fontSize="sm"
      fontVariantNumeric="tabular-nums"
      role="status"
      aria-label="ポイントの目安"
    >
      {preview ? (
        <>
          この注文で{preview.shop ? `（${preview.shop}店舗目）` : ""}{" "}
          <Text as="b" color="primary.fg">
            約 +{pointsText(preview.points)}
          </Text>
        </>
      ) : (
        <Text as="span" color="fg.muted">
          金額を入れると、増えるポイントの目安が出ます
        </Text>
      )}
    </Text>
  );
}

/**
 * 「＋ 注文を追加」 at the end of the desktop list. Enter in any field adds the order when it is
 * valid, then empties the form and puts the focus back on its first field.
 */
export function OrderAddForm({ plan }: { plan: Plan }) {
  const shops = useAtomValue(shopsAtom);
  const saveDraft = useSaveOrderDraft(plan.id, useSetAtom(orderSaveFailedAtom));
  const run = useSingleFlight();
  const [open, setOpen] = useState(plan.orders.length === 0);
  // The form and an opened row take turns: opening one closes the other.
  const [openOrderId, setOpenOrderId] = useAtom(openOrderIdAtom);
  if (open && openOrderId !== null) setOpen(false);
  const form = useForm({ schema: OrderFormSchema, initialInput: emptyInput(plan.period) });
  const autofill = useOrderAutofill(form);
  const formId = useId();

  const add = (output: OrderFormOutput) =>
    run(async () => {
      // Not saved, the typed order stays in the form so it can be added again.
      if (!(await saveDraft(draftOf(output, shops, undefined), true))) return;
      reset(form, { initialInput: emptyInput(plan.period) });
      focus(form, { path: ["url"] });
      // After the focus moves: leaving the URL field would look up the URL it still shows.
      autofill.reset();
    });

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  return (
    <List.Item borderTopWidth={plan.orders.length > 0 ? "1px" : undefined}>
      <Button
        variant="ghost"
        colorScheme="primary"
        size="xl"
        // As tall as an order's row above it.
        minH="16"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => {
          if (!open) setOpenOrderId(null);
          setOpen(!open);
        }}
        w="full"
        justifyContent="flex-start"
        pe="3"
        startIcon={<PlusIcon />}
      >
        注文を追加
        <Text as="span" fontWeight="normal" fontSize="xs" color="fg.muted">
          （Enter で追加して次の注文へ）
        </Text>
        {/* Where an order's row has its chevron. */}
        <Flex as="span" boxSize="11" ml="auto" align="center" justify="center" color="fg.muted">
          <ChevronIcon open={open} />
        </Flex>
      </Button>
      {/* Shut, the fields are taken out; what was typed stays in the form. */}
      <Collapse open={open} unmountOnExit>
        <Form of={form} id={formId} onKeyDown={onKeyDown} onSubmit={add}>
          <Flex direction="column" gap="3" borderTopWidth="1px" pt="3.5" pb="4" px="4">
            <OrderFormFields form={form} plan={plan} autofill={autofill} />
            <Flex wrap="wrap" align="center" gap="2">
              <AddedPointsEstimate plan={plan} form={form} />
              <Button type="submit" colorScheme="primary" size="lg" minW={ACTION_BUTTON_WIDTH}>
                追加する
              </Button>
            </Flex>
            <CapFlows plan={plan} form={form} />
          </Flex>
        </Form>
      </Collapse>
    </List.Item>
  );
}
