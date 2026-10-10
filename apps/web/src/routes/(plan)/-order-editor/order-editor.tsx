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
  setInput,
  useField,
  useForm,
} from "@formisch/react";
import { type Order, type Plan, channels } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  ButtonGroup,
  Drawer,
  Field,
  Fieldset,
  IconButton,
  Input,
  InputGroup,
  Modal,
  NativeAccordion,
  NativeSelect,
  Switch,
  Text,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type RefObject, useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { type FieldState, Form, bind, errorsOf } from "../../../form/form";
import { saveShopAtom } from "../../../state/mutations";
import { addOrderAtom, updateOrderAtom } from "../../../state/order-ops";
import { shopsAtom } from "../../../state/queries";
import { useSingleFlight } from "../../../use-single-flight";
import { CloseIcon } from "../../../ui/icons";
import { AutofillStatus, type ItemAutofill } from "../-item-autofill";
import {
  NEW_SHOP,
  TAX_RATES,
  TaxRateOptions,
  ToggleChip,
  shopFromUrl,
  useSortedShops,
} from "../-order-fields";
import { CampaignChip } from "../-order-shared";
import { FormDatePicker } from "../-date-picker-field";
import {
  type OrderFormInput,
  OrderFormSchema,
  type OrderFormOutput,
  dateCampaigns,
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
  useFormInput,
  useOrderAutofill,
} from "./order-form-store";
import { OrderPreviewBox } from "./order-preview";

/** The editor's target in the URL (`edit=`): a new order, or the id of the order to edit. */
export const NEW_ORDER = "new";

const taxLabels: Record<(typeof TAX_RATES)[number], string> = {
  "0.1": "10%",
  "0.08": "8%（食品）",
  "0": "非課税",
};

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
function ItemDetailFields({ form, index }: { form: OrderForm; index: number }) {
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
      <FormField of={form} path={["items", index, "shopPointRate"]}>
        {(field) => (
          <InlineField label="ショップ独自倍率" field={field} inputMode="decimal" placeholder="1" />
        )}
      </FormField>
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
          <Field.Root label="商品名メモ" {...errorsOf(field)}>
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
  const date = useField(form, { path: ["date"] });
  const plus = (rate: number) => (rate > 0 ? ` +${rate}` : "");
  const byDate = dateCampaigns(plan.benefits, typeof date.input === "string" ? date.input : "");
  return (
    <Fieldset.Root legend="キャンペーン">
      <Flex wrap="wrap" gap="2">
        <ToggleChip pressed={is39.input === true} onClick={() => is39.onChange(!is39.input)}>
          39ショップ{plus(tagBonus(plan.benefits, { shop: "39shop" }))}
        </ToggleChip>
        <ToggleChip pressed={repeat.input === true} onClick={() => repeat.onChange(!repeat.input)}>
          リピート購入{plus(tagBonus(plan.benefits, { order: "repeat" }))}
        </ToggleChip>
      </Flex>
      {byDate.length > 0 ? (
        <Flex wrap="wrap" align="center" gap="1.5" fontSize="xs" color="fg.muted">
          <span>日付で自動：</span>
          {byDate.map((benefit) => (
            <CampaignChip key={benefit.id}>
              {benefit.label}
              {plus(rateOf(benefit))}
            </CampaignChip>
          ))}
        </Flex>
      ) : null}
    </Fieldset.Root>
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
  const sortedShops = useSortedShops(shops);
  const url = useField(form, { path: ["url"] });
  const shop = useField(form, { path: ["shop"] });

  // The shop of the URL is chosen at once, and stays when the item cannot be looked up.
  const onUrl = (text: string) => {
    url.onChange(text);
    const found = shopFromUrl(text, shops);
    if (found) applyShop(form, found);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
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
        label="商品のURL（貼るとショップを選びます）"
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
      <Box display="grid" gridTemplateColumns="minmax(0, 1fr) 150px" alignItems="start" gap="2">
        <Field.Root label="ショップ" {...errorsOf(shop)}>
          <NativeSelect.Root
            {...bind(shop)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              shop.onChange(value);
              const chosen = shops.find((other) => other.id === value);
              if (chosen) setInput(form, { path: ["is39"], input: chosen.tags.includes("39shop") });
            }}
          >
            <option value="">ショップを選ぶ</option>
            {sortedShops.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
                {other.tags.includes("39shop") ? "（39）" : ""}
              </option>
            ))}
            <option value={NEW_SHOP}>＋ 新しいショップ</option>
          </NativeSelect.Root>
        </Field.Root>
        <FormField of={form} path={["date"]}>
          {(field) => (
            <Field.Root label="注文日" {...errorsOf(field)}>
              <FormDatePicker field={field} period={plan.period} />
            </Field.Root>
          )}
        </FormField>
      </Box>
      {shop.input === NEW_SHOP ? (
        <Box display="grid" gridTemplateColumns="minmax(0, 1fr) 150px" alignItems="start" gap="2">
          <FormField of={form} path={["newShopName"]}>
            {(field) => (
              <Field.Root label="新しいショップの名前" {...errorsOf(field)}>
                <Input {...bind(field)} />
              </Field.Root>
            )}
          </FormField>
          <FormField of={form} path={["channel"]}>
            {(field) => (
              <Field.Root label="購入先" invalid={field.errors !== null}>
                <NativeSelect.Root {...bind(field)}>
                  {Object.values(channels).map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.label}
                    </option>
                  ))}
                </NativeSelect.Root>
              </Field.Root>
            )}
          </FormField>
        </Box>
      ) : null}
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
    <>
      <FormField of={form} path={AMOUNT_PATH}>
        {(field) => (
          <Field.Root label="金額（税込）" {...errorsOf(field)}>
            <InputGroup.Root size="xl">
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
      <FormField of={form} path={["items", 0, "name"]}>
        {(field) => (
          <Field.Root label="商品名メモ（任意）" {...errorsOf(field)}>
            <Input placeholder="例：洗濯洗剤 詰め替え" {...bind(field)} />
          </Field.Root>
        )}
      </FormField>
      <FormField of={form} path={["items", 0, "taxRate"]}>
        {(field) => (
          <Fieldset.Root legend="税率">
            <ButtonGroup.Root attached>
              {TAX_RATES.map((rate) => {
                const selected = field.input === rate;
                return (
                  <ButtonGroup.Item
                    key={rate}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => field.onChange(rate)}
                    variant={selected ? "solid" : "outline"}
                    colorScheme={selected ? "primary" : undefined}
                    flex="1"
                  >
                    {taxLabels[rate]}
                  </ButtonGroup.Item>
                );
              })}
            </ButtonGroup.Root>
          </Fieldset.Root>
        )}
      </FormField>
    </>
  );
}

function Details({ form, defaultOpen }: { form: OrderForm; defaultOpen: boolean }) {
  return (
    // The animated panel clips its content, which cuts the focus rings of the switch and the add
    // button at its edges.
    <NativeAccordion.Root animate={false}>
      <NativeAccordion.Item open={defaultOpen}>
        <NativeAccordion.Button>
          詳細設定（数量・クーポン・ショップ倍率・保留・商品を追加）
        </NativeAccordion.Button>
        <NativeAccordion.Panel>
          <Flex direction="column" gap="2">
            <ItemDetailFields form={form} index={0} />
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
  onClose: () => void;
};

/** The header, fields and buttons inside the sheet or the dialog. */
function EditorContent({ plan, original, layout, amountRef, onClose }: EditorProps) {
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
    original ? inputOf(original, shops) : emptyInput(),
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
          reset(form, { initialInput: emptyInput() });
          focus(form, { path: AMOUNT_PATH });
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
      <parts.Header display="flex" alignItems="center" justifyContent="space-between">
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
            <MainItemFields form={form} amountRef={amountRef} />
            <Campaigns form={form} plan={plan} />
            <Preview form={form} plan={plan} original={original} />
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
      withCloseButton={false}
      initialFocusRef={amountRef}
      restoreFocus
    >
      <Drawer.Content maxH="calc(100dvh - 24px)">{content}</Drawer.Content>
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
