// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import {
  Field as FormField,
  FieldArray,
  focus,
  insert,
  remove,
  reset,
  useField,
  useForm,
} from "@formisch/react";
import type { Order, Plan } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  Drawer,
  Field,
  Fieldset,
  IconButton,
  Input,
  InputGroup,
  Modal,
  NativeAccordion,
  NativeSelect,
  Separator,
  Switch,
  Text,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { useDragControls } from "motion/react";
import {
  type PointerEvent,
  type RefObject,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type FieldState, Form, bind, errorsOf } from "../../../form/form";
import { saveShopAtom } from "../../../state/mutations";
import { addOrderAtom, updateOrderAtom } from "../../../state/order-ops";
import { shopsAtom } from "../../../state/queries";
import { useSingleFlight } from "../../../use-single-flight";
import { CloseIcon } from "../../../ui/icons";
import { AutofillStatus, type ItemAutofill } from "../-item-autofill";
import {
  CampaignCheck,
  ChannelField,
  OrderPart,
  ShopRateInput,
  TaxRateButtons,
  TaxRateOptions,
  UrlLabel,
  optionalMark,
  shopFromUrl,
} from "../-order-fields";
import { ShopAutocomplete } from "../-shop-autocomplete";
import { CampaignChip } from "../-order-shared";
import { FormDatePicker } from "../-date-picker-field";
import {
  type OrderFormInput,
  OrderFormSchema,
  type OrderFormOutput,
  dateCampaigns,
  hasOrderTagCampaign,
  draftOf,
  draftOfInput,
  emptyInput,
  emptyItem,
  inputOf,
  rateOf,
  tagBonus,
} from "./order-form";
import {
  AMOUNT_PATH,
  type OrderForm,
  applyShop,
  autofillUrlHandlers,
  urlFromPastedText,
  useFormInput,
  useOrderAutofill,
} from "./order-form-store";
import { OrderPreviewBox } from "./order-preview";
import { CapFlows } from "../-cap-flows";

/** The editor's target in the URL (`edit=`): a new order, or the id of the order to edit. */
export const NEW_ORDER = "new";

/** A label on the left and a short field on the right (the details rows), the error under both. */
function InlineField({
  label,
  field,
  inputMode,
  placeholder,
}: {
  label: string;
  field: FieldState;
  inputMode: "numeric" | "decimal";
  placeholder?: string;
}) {
  return (
    <Field.Root
      label={label}
      {...errorsOf(field)}
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      alignItems="center"
      columnGap="3"
      errorMessageProps={{ gridColumn: "1 / -1" }}
    >
      <Input
        w="24"
        textAlign="end"
        fontVariantNumeric="tabular-nums"
        inputMode={inputMode}
        placeholder={placeholder}
        {...bind(field)}
      />
    </Field.Root>
  );
}

/** Quantity, coupon and the shop's own rate of one item. */
function ItemDetailFields({
  form,
  index,
  withRate = true,
}: {
  form: OrderForm;
  index: number;
  /** The first item's rate is next to its amount, so it is left out here. */
  withRate?: boolean;
}) {
  return (
    <>
      <FormField of={form} path={["items", index, "quantity"]}>
        {(field) => <InlineField label="数量" field={field} inputMode="numeric" />}
      </FormField>
      <FormField of={form} path={["items", index, "discount"]}>
        {(field) => (
          <InlineField
            label="クーポン値引額（税込）"
            field={field}
            inputMode="numeric"
            placeholder="0"
          />
        )}
      </FormField>
      {withRate ? (
        <FormField of={form} path={["items", index, "shopPointRate"]}>
          {(field) => (
            <InlineField
              label="ショップ独自倍率"
              field={field}
              inputMode="decimal"
              placeholder="1"
            />
          )}
        </FormField>
      ) : null}
    </>
  );
}

/** An item after the first one, added with 「同じショップの商品を追加」. */
function ExtraItem({ form, index }: { form: OrderForm; index: number }) {
  const label = `商品${index + 1}`;
  return (
    <Fieldset.Root legend={label} variant="outline" size="sm">
      <FormField of={form} path={["items", index, "name"]}>
        {(field) => (
          <Field.Root label="商品名" {...errorsOf(field)}>
            <Input {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <Box
        display="grid"
        gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
        alignItems="start"
        gap="2"
      >
        <FormField of={form} path={["items", index, "unitPrice"]}>
          {(field) => (
            <Field.Root label="金額（税込）" {...errorsOf(field)}>
              <Input
                textAlign="end"
                fontVariantNumeric="tabular-nums"
                inputMode="numeric"
                {...bind(field)}
              />
            </Field.Root>
          )}
        </FormField>
        <FormField of={form} path={["items", index, "taxRate"]}>
          {(field) => (
            <Field.Root label="税率" invalid={field.errors !== null}>
              <NativeSelect.Root {...bind(field)}>
                <TaxRateOptions />
              </NativeSelect.Root>
            </Field.Root>
          )}
        </FormField>
      </Box>
      <ItemDetailFields form={form} index={index} />
      <Button
        type="button"
        variant="outline"
        colorScheme="danger"
        alignSelf="flex-start"
        onClick={() => remove(form, { path: ["items"], at: index })}
      >
        {label}を削除
      </Button>
    </Fieldset.Root>
  );
}

function Preview({ form, plan, original }: { form: OrderForm; plan: Plan; original?: Order }) {
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

function ShopFields({
  form,
  plan,
  urlId,
  autofill,
}: {
  form: OrderForm;
  plan: Plan;
  urlId: string;
  autofill: ItemAutofill;
}) {
  const shops = useAtomValue(shopsAtom);
  const url = useField(form, { path: ["url"] });

  // The shop of the URL is chosen at once, and stays when the item cannot be looked up.
  const onUrl = (text: string) => {
    url.onChange(text);
    const found = shopFromUrl(text, shops);
    if (found) applyShop(form, found);
  };

  const paste = async () => {
    try {
      const text = urlFromPastedText(await navigator.clipboard.readText());
      onUrl(text);
      autofill.onUrlChange(text, true);
    } catch {
      // Reading the clipboard was not allowed; the URL can still be pasted into the field.
      document.getElementById(urlId)?.focus();
    }
  };

  const urlText = typeof url.input === "string" ? url.input.trim() : "";
  // Not an error: the order can still be saved with a URL no shop is chosen from.
  const urlUnknown = url.errors === null && urlText !== "" && shopFromUrl(urlText, shops) === null;
  const hintId = useId();

  return (
    <>
      <Field.Root
        id={urlId}
        label={<UrlLabel />}
        optionalIndicator={optionalMark}
        {...errorsOf(url)}
        helperMessage={urlUnknown ? "このURLからはショップを選べません" : undefined}
        helperMessageProps={{ id: hintId }}
      >
        <Flex gap="2">
          <Input
            {...bind(url)}
            flex="1"
            type="url"
            inputMode="url"
            placeholder="https://item.rakuten.co.jp/…"
            // Field links a helper message only when the field's invalid state changes, and this
            // one comes and goes while the field stays valid.
            {...(url.errors === null
              ? { "aria-describedby": urlUnknown ? hintId : undefined }
              : {})}
            {...autofillUrlHandlers(autofill, onUrl, url.props.onBlur)}
          />
          <Button type="button" variant="outline" flex="none" onClick={() => void paste()}>
            貼り付け
          </Button>
        </Flex>
        <AutofillStatus autofill={autofill} />
      </Field.Root>
      <OrderPart legend="購入">
        <ShopAutocomplete form={form} />
        <Box
          display="grid"
          gridTemplateColumns="repeat(2, minmax(0, 1fr))"
          alignItems="start"
          gap="2"
        >
          <ChannelField form={form} />
          <FormField of={form} path={["date"]}>
            {(field) => (
              <Field.Root label="注文日" {...errorsOf(field)}>
                <FormDatePicker field={field} period={plan.period} />
              </Field.Root>
            )}
          </FormField>
        </Box>
      </OrderPart>
    </>
  );
}

function MainItemFields({
  form,
  amountRef,
}: {
  form: OrderForm;
  amountRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <OrderPart legend="商品">
      <FormField of={form} path={["items", 0, "name"]}>
        {(field) => (
          <Field.Root label="商品名" optionalIndicator={optionalMark} {...errorsOf(field)}>
            <Input placeholder="例：洗濯洗剤 詰め替え" {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <Box display="grid" gridTemplateColumns="minmax(0, 1fr) 150px" alignItems="start" gap="2">
        <FormField of={form} path={AMOUNT_PATH}>
          {(field) => (
            <Field.Root label="金額（税込）" {...errorsOf(field)}>
              <InputGroup.Root>
                <InputGroup.Addon aria-hidden="true">¥</InputGroup.Addon>
                <Input
                  {...bind(field)}
                  ref={(element: HTMLInputElement | null) => {
                    field.props.ref(element);
                    amountRef.current = element;
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  textAlign="end"
                  fontVariantNumeric="tabular-nums"
                />
              </InputGroup.Root>
            </Field.Root>
          )}
        </FormField>
        <FormField of={form} path={["items", 0, "shopPointRate"]}>
          {(field) => <ShopRateInput field={field} />}
        </FormField>
      </Box>
      <FormField of={form} path={["items", 0, "taxRate"]}>
        {(field) => <TaxRateButtons field={field} fill />}
      </FormField>
    </OrderPart>
  );
}

function Details({ form, defaultOpen }: { form: OrderForm; defaultOpen: boolean }) {
  return (
    // The animated panel clips its content, which cuts the focus rings of the switch and the add
    // button at its edges.
    <NativeAccordion.Root animate={false}>
      <NativeAccordion.Item open={defaultOpen}>
        <NativeAccordion.Button>
          詳細設定（数量・クーポン・保留・商品を追加）
        </NativeAccordion.Button>
        <NativeAccordion.Panel>
          <Flex direction="column" gap="2">
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
            <FieldArray of={form} path={["items"]}>
              {(items) => (
                <Flex direction="column" gap="2">
                  {items.items.map((key, index) =>
                    index === 0 ? null : <ExtraItem key={key} form={form} index={index} />,
                  )}
                  {items.errors ? (
                    <Text role="alert" fontSize="sm" color="danger.fg">
                      {items.errors[0]}
                    </Text>
                  ) : null}
                </Flex>
              )}
            </FieldArray>
            <Button
              type="button"
              variant="ghost"
              colorScheme="primary"
              alignSelf="flex-start"
              onClick={() => insert(form, { path: ["items"], initialInput: emptyItem() })}
            >
              ＋ 同じショップの商品を追加
            </Button>
          </Flex>
        </NativeAccordion.Panel>
      </NativeAccordion.Item>
    </NativeAccordion.Root>
  );
}

type EditorProps = {
  plan: Plan;
  original: Order | undefined;
  layout: "sheet" | "dialog";
  amountRef: RefObject<HTMLInputElement | null>;
  /** Starts dragging the sheet down from its header. WORKAROUND(yamada-drawer-drag) */
  onDragStart: (event: PointerEvent) => void;
  onClose: () => void;
};

/** The header, fields and buttons inside the sheet or the dialog. */
function EditorContent({ plan, original, layout, amountRef, onDragStart, onClose }: EditorProps) {
  const shops = useAtomValue(shopsAtom);
  const saveShop = useAtomValue(saveShopAtom);
  const addOrder = useSetAtom(addOrderAtom);
  const updateOrder = useSetAtom(updateOrderAtom);
  const [failed, setFailed] = useState(false);
  const run = useSingleFlight();
  const formId = useId();
  const urlId = useId();
  const keepOpenId = useId();
  // The fields start from the order as it was when the editor opened.
  const [initialInput] = useState<OrderFormInput>(() =>
    original ? inputOf(original, shops) : emptyInput(plan.period),
  );
  const form = useForm({ schema: OrderFormSchema, initialInput });
  const autofill = useOrderAutofill(form);
  const parts = layout === "sheet" ? Drawer : Modal;
  const title = original ? "注文を編集" : "注文を追加";

  const save = async (output: OrderFormOutput, keepOpen: boolean) => {
    await run(async () => {
      const draft = draftOf(output, shops, original);
      if (!draft) {
        setFailed(true);
        return;
      }
      setFailed(false);
      try {
        if (draft.shopChange) await saveShop.mutateAsync(draft.shopChange);
        if (original) await updateOrder({ planId: plan.id, order: draft.order });
        else await addOrder({ planId: plan.id, order: draft.order });
        if (keepOpen) {
          reset(form, { initialInput: emptyInput(plan.period) });
          // On a phone the focus would only bring up the keyboard over the sheet.
          if (layout === "dialog") focus(form, { path: AMOUNT_PATH });
          // After the focus moves: leaving the URL field would look up the URL it still shows.
          autofill.reset();
        } else {
          onClose();
        }
      } catch {
        // What was typed stays in the fields so it can be saved again.
        setFailed(true);
      }
    });
  };

  return (
    <>
      <parts.Header
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        // WORKAROUND(yamada-drawer-drag): the header is a handle of the sheet's drag.
        {...(layout === "sheet" ? { touchAction: "none", onPointerDown: onDragStart } : {})}
      >
        <parts.Title as="h2">{title}</parts.Title>
        <IconButton aria-label="閉じる" onClick={onClose} icon={<CloseIcon />} variant="ghost" />
      </parts.Header>
      <parts.Body alignItems="stretch">
        <Form
          of={form}
          id={formId}
          onSubmit={(output, event) =>
            save(output, (event.nativeEvent as SubmitEvent).submitter?.id === keepOpenId)
          }
        >
          <Flex direction="column" gap="3.5">
            <ShopFields form={form} plan={plan} urlId={urlId} autofill={autofill} />
            <Separator />
            <MainItemFields form={form} amountRef={amountRef} />
            <Separator />
            <Campaigns form={form} plan={plan} />
            <Preview form={form} plan={plan} original={original} />
            {original ? null : <CapFlows plan={plan} form={form} />}
            <Details form={form} defaultOpen={(original?.lineItems.length ?? 1) > 1} />
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
  // WORKAROUND(yamada-drawer-drag): see the sheet's Drawer.Content below.
  const dragControls = useDragControls();
  const onDragStart = (event: PointerEvent) => dragControls.start(event);
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
      onDragStart={onDragStart}
      onClose={onClose}
    />
  ) : null;

  return layout === "sheet" ? (
    <Drawer.Root
      open={open}
      onClose={onClose}
      placement="block-end"
      closeOnDrag
      withCloseButton={false}
      // On a phone a focused field would only bring up the keyboard over the sheet. The sheet
      // itself takes the focus, so Escape and Tab stay inside it.
      autoFocus={false}
      initialFocusRef={sheetRef}
      restoreFocus
    >
      {/*
        WORKAROUND(yamada-drawer-drag): Drawer's closeOnDrag makes the whole content draggable and
        gives it `touch-action: pan-x`, so a swipe in the scrolling body drags the sheet instead:
        up it only stretches, down it closes. Drawer has no prop to drag from a handle only, so
        motion's own props are passed through, and the header and the drag bar start the drag.
        Drop this when Drawer can scroll its body and close on drag together.
      */}
      <Drawer.Content
        ref={sheetRef}
        tabIndex={-1}
        outline="none"
        maxH="calc(100dvh - 24px)"
        roundedTop="l2"
        dragControls={dragControls}
        dragListener={false}
      >
        <Drawer.DragBar touchAction="none" onPointerDown={onDragStart} />
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
