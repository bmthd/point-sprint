// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, reset, useField, useForm } from "@formisch/react";
import type { Order, Plan } from "@workspaces/domain";
import { Box, Flex, Button, Drawer, IconButton, Modal, Switch, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type RefObject, useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { Form } from "#/routes/-form.tsx";
import { shopsAtom } from "#/state/queries.ts";
import { useSingleFlight } from "#/use-single-flight.ts";
import { CloseIcon } from "#/ui/icons.tsx";
import { CampaignCheck, OrderPart } from "#/routes/(plan)/-order-fields.tsx";
import { CampaignChip, useSaveOrderDraft } from "#/routes/(plan)/-order-shared.tsx";
import {
  type OrderFormInput,
  OrderFormSchema,
  type OrderFormOutput,
  dateCampaigns,
  hasOrderTagCampaign,
  draftOf,
  draftOfInput,
  emptyInput,
  hasDetails,
  inputOf,
  rateOf,
  tagBonus,
} from "#/routes/(plan)/-order-form.ts";
import {
  type OrderForm,
  useFormInput,
  useOrderAutofill,
} from "#/routes/(plan)/-order-form-store.ts";
import {
  AmountField,
  Conditions,
  EntryModeSwitch,
  ShopAndName,
  UrlField,
  focusFirstField,
  useEnterUrl,
  useEntryMode,
} from "#/routes/(plan)/-order-entry.tsx";
import { OrderPreviewBox } from "./order-preview.tsx";
import { CapFlows } from "#/routes/(plan)/-cap-flows.tsx";
import { ExtraItems, ItemDetailFields } from "#/routes/(plan)/-item-details.tsx";

/** The editor's target in the URL (`edit=`): a new order, or the id of the order to edit. */
export const NEW_ORDER = "new";

/** The points the order the form describes gets, in the editor. */
function DraftPreview({ form, plan, original }: { form: OrderForm; plan: Plan; original?: Order }) {
  const shops = useAtomValue(shopsAtom);
  const current = useFormInput(form);
  const key = JSON.stringify(current);
  // Calculating every plan again is the heavy part, so it may lag a keystroke behind.
  const deferred = useDeferredValue(key);
  const draft = useMemo(
    () => draftOfInput(JSON.parse(deferred), shops, original),
    [deferred, shops, original],
  );
  return <OrderPreviewBox planId={plan.id} draft={draft} original={original} />;
}

function Campaigns({ form, plan }: { form: OrderForm; plan: Plan }) {
  const is39 = useField(form, { path: ["is39"] });
  const repeat = useField(form, { path: ["repeat"] });
  const brandDay = useField(form, { path: ["brandDay"] });
  const is24h = useField(form, { path: ["is24h"] });
  const date = useField(form, { path: ["date"] });
  const plus = (rate: number) => (rate > 0 ? `+${rate}` : "");
  const byDate = dateCampaigns(plan.benefits, typeof date.input === "string" ? date.input : "");
  return (
    <OrderPart legend="キャンペーン">
      {/* Cards of one width, two to a row, so their checks line up. */}
      <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="2">
        <CampaignCheck
          campaign="39shop"
          checked={is39.input === true}
          onChange={() => is39.onChange(!is39.input)}
          rate={plus(tagBonus(plan.benefits, { shop: "39shop" }))}
        >
          39ショップ
        </CampaignCheck>
        <CampaignCheck
          campaign="repeat"
          checked={repeat.input === true}
          onChange={() => repeat.onChange(!repeat.input)}
          rate={plus(tagBonus(plan.benefits, { order: "repeat" }))}
        >
          リピート購入
        </CampaignCheck>
        {/* Asked only when the plan has a brand day, or the order is marked already. */}
        {hasOrderTagCampaign(plan.benefits, "brand-day") || brandDay.input === true ? (
          <CampaignCheck
            campaign="brand-day"
            checked={brandDay.input === true}
            onChange={() => brandDay.onChange(!brandDay.input)}
          >
            ブランドデー対象
          </CampaignCheck>
        ) : null}
        <CampaignCheck
          campaign="24h"
          checked={is24h.input === true}
          onChange={() => is24h.onChange(!is24h.input)}
          rate={plus(tagBonus(plan.benefits, { order: "24h" }))}
        >
          24時間限定
        </CampaignCheck>
      </Box>
      {byDate.length > 0 ? (
        <Flex wrap="wrap" align="center" gap="1.5" fontSize="xs" color="fg.muted">
          <span>日付で自動：</span>
          {byDate.map((benefit) => (
            <CampaignChip key={benefit.id}>
              {benefit.label}
              {rateOf(benefit) > 0 ? ` ${plus(rateOf(benefit))}` : ""}
            </CampaignChip>
          ))}
        </Flex>
      ) : null}
    </OrderPart>
  );
}

/** Quantity, coupon, the items after the first one and 保留, last in 「条件」. */
function Details({ form }: { form: OrderForm }) {
  return (
    <>
      <ItemDetailFields form={form} index={0} withRate={false} />
      <FormField of={form} path={["onHold"]}>
        {(field) => (
          <Switch
            {...field.props}
            checked={field.input === true}
            colorScheme="primary"
            reverse
            justifyContent="space-between"
            // The whole row is the switch's label: a 44px tap target.
            minH="11"
          >
            保留（計算から外す）
          </Switch>
        )}
      </FormField>
      <ExtraItems form={form} />
    </>
  );
}

type EditorProps = {
  plan: Plan;
  original: Order | undefined;
  layout: "sheet" | "dialog";
  amountRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
};

/** The header, fields and buttons inside the sheet or the dialog. */
function EditorContent({ plan, original, layout, amountRef, onClose }: EditorProps) {
  const shops = useAtomValue(shopsAtom);
  const [failed, setFailed] = useState(false);
  const saveDraft = useSaveOrderDraft(plan.id, setFailed);
  const run = useSingleFlight();
  const formId = useId();
  const keepOpenId = useId();
  // The fields start from the order as it was when the editor opened.
  const [initialInput] = useState<OrderFormInput>(() =>
    original ? inputOf(original, shops) : emptyInput(plan.period),
  );
  const form = useForm({ schema: OrderFormSchema, initialInput });
  const autofill = useOrderAutofill(form);
  const enterUrl = useEnterUrl(form, autofill);
  // A new order starts the way the last one was entered; an order being edited, by its URL if it
  // has one.
  const [mode, setMode] = useEntryMode(!original, original?.lineItems[0]?.url ? "url" : "amount");
  // On a phone the focus would only bring up the keyboard over the sheet.
  const focusFirst = (next: typeof mode) => {
    if (layout === "dialog") focusFirstField(form, next);
  };
  const parts = layout === "sheet" ? Drawer : Modal;
  const title = original ? "注文を編集" : "注文を追加";

  const save = async (output: OrderFormOutput, keepOpen: boolean) => {
    await run(async () => {
      // Not saved, what was typed stays in the fields so it can be saved again.
      if (!(await saveDraft(draftOf(output, shops, original), !original))) return;
      if (keepOpen) {
        reset(form, { initialInput: emptyInput(plan.period) });
        focusFirst(mode);
        // Leaving the URL field would look up the URL it still showed.
        autofill.reset();
      } else {
        onClose();
      }
    });
  };

  const amount = (
    <AmountField
      form={form}
      inputRef={amountRef}
      aside={<DraftPreview form={form} plan={plan} original={original} />}
      onUrlPasted={(url) => {
        setMode("url");
        enterUrl(url);
      }}
    />
  );

  const header = (
    <parts.Header display="flex" alignItems="center" justifyContent="space-between">
      <parts.Title as="h2">{title}</parts.Title>
      <IconButton aria-label="閉じる" onClick={onClose} icon={<CloseIcon />} variant="ghost" />
    </parts.Header>
  );

  return (
    <>
      {/* The header drags the sheet down, as the drag bar does. */}
      {layout === "sheet" ? <Drawer.DragTrigger>{header}</Drawer.DragTrigger> : header}
      <parts.Body alignItems="stretch">
        <Form
          of={form}
          id={formId}
          onSubmit={(output, event) =>
            save(output, (event.nativeEvent as SubmitEvent).submitter?.id === keepOpenId)
          }
        >
          <Flex direction="column" gap="3.5">
            {original ? null : (
              <EntryModeSwitch
                mode={mode}
                fill={layout === "sheet"}
                onChange={(next) => {
                  setMode(next);
                  focusFirst(next);
                }}
              />
            )}
            {mode === "url" ? (
              <>
                <UrlField form={form} autofill={autofill} withPaste={layout === "sheet"} />
                <ShopAndName form={form} />
                {amount}
              </>
            ) : (
              <>
                {amount}
                <ShopAndName form={form} />
              </>
            )}
            <Conditions
              form={form}
              plan={plan}
              defaultOpen={original ? hasDetails(original) : false}
              campaigns={<Campaigns form={form} plan={plan} />}
            >
              <Details form={form} />
            </Conditions>
            {original ? null : <CapFlows plan={plan} form={form} />}
          </Flex>
        </Form>
      </parts.Body>
      <parts.Footer
        // Clear of a phone's home indicator.
        pb="calc(20px + env(safe-area-inset-bottom))"
        flexDirection="column"
      >
        {failed ? (
          <Text role="alert" alignSelf="stretch" fontSize="sm" color="danger.fg">
            保存できませんでした。もう一度お試しください。
          </Text>
        ) : null}
        <Flex gap="2" alignSelf="stretch">
          {original ? null : (
            <Button
              id={keepOpenId}
              type="submit"
              form={formId}
              variant="outline"
              size="lg"
              flex="1"
            >
              続けて追加
            </Button>
          )}
          <Button type="submit" form={formId} colorScheme="primary" size="lg" flex="1">
            {original ? "保存する" : "追加する"}
          </Button>
        </Flex>
      </parts.Footer>
    </>
  );
}

/**
 * Adding or editing an order: a sheet from the bottom on a phone, a dialog on a desktop. `target`
 * is `NEW_ORDER`, the id of the order to edit, or `undefined` when the editor is closed.
 */
export function OrderEditor({
  plan,
  target,
  layout,
  onClose,
}: {
  plan: Plan;
  target: string | undefined;
  layout: "sheet" | "dialog";
  onClose: () => void;
}) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const original =
    target === undefined || target === NEW_ORDER
      ? undefined
      : plan.orders.find((order) => order.id === target);
  const open = target === NEW_ORDER || original !== undefined;
  const content = open ? (
    <EditorContent
      key={target}
      plan={plan}
      original={original}
      layout={layout}
      amountRef={amountRef}
      onClose={onClose}
    />
  ) : null;

  return layout === "sheet" ? (
    <Drawer.Root
      open={open}
      onClose={onClose}
      placement="block-end"
      closeOnDrag
      // Only the drag bar and the header drag the sheet, so the fields can be dragged to scroll.
      dragHandleOnly
      withCloseButton={false}
      // On a phone a focused field would only bring up the keyboard over the sheet. The sheet
      // itself takes the focus, so Escape and Tab stay inside it.
      autoFocus={false}
      initialFocusRef={sheetRef}
      restoreFocus
    >
      <Drawer.Content
        ref={sheetRef}
        tabIndex={-1}
        outline="none"
        maxH="calc(100dvh - 24px)"
        roundedTop="l2"
      >
        <Drawer.DragBar />
        {content}
      </Drawer.Content>
    </Drawer.Root>
  ) : (
    <Modal.Root
      open={open}
      onClose={onClose}
      size="2xl"
      withCloseButton={false}
      initialFocusRef={amountRef}
      restoreFocus
    >
      <Modal.Content maxH="calc(100dvh - 48px)">{content}</Modal.Content>
    </Modal.Root>
  );
}
