"use no memo";

// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change (as in the order editor).

import { useForm } from "@formisch/react";
import type { Order, Plan } from "@workspaces/domain";
import { Button, Card, Flex, Heading, IconButton, XIcon } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { CapFlows } from "#/routes/(plan)/-cap-flows.tsx";
import { NEW_SHOP } from "#/routes/(plan)/-order-fields.tsx";
import { Campaigns, Details, DraftPreview } from "#/routes/(plan)/-order-editor/order-editor.tsx";
import {
  AmountField,
  Conditions,
  EntryModeSwitch,
  ShopAndName,
} from "#/routes/(plan)/-order-entry.tsx";
import {
  type OrderFormInput,
  OrderFormSchema,
  emptyInputForDate,
  emptyItem,
  inputOf,
} from "#/routes/(plan)/-order-form.ts";
import { Form } from "#/routes/-form.tsx";
import { shopsAtom } from "#/state/query-atoms.ts";
import { SAMPLE_TODAY } from "./sample-data.ts";

const ignore = () => {};

/**
 * The order editor's fields, as the sheet on a phone lays them out, holding `input`: the parts the
 * editor puts in its sheet, without the sheet, which covers the page.
 */
function OrderEditorSheet({
  plan,
  original,
  input,
}: {
  plan: Plan;
  original: Order | undefined;
  input: OrderFormInput;
}) {
  const form = useForm({ schema: OrderFormSchema, initialInput: input });
  return (
    <Card.Root>
      <Card.Header display="flex" alignItems="center" justifyContent="space-between">
        <Heading as="h2" fontSize="lg">
          {original ? "注文を編集" : "注文を追加"}
        </Heading>
        <IconButton aria-label="閉じる" icon={<XIcon />} variant="ghost" />
      </Card.Header>
      <Card.Body alignItems="stretch">
        <Form of={form} onSubmit={ignore}>
          <Flex direction="column" gap="3.5">
            {original ? null : <EntryModeSwitch mode="amount" fill onChange={ignore} />}
            <AmountField
              form={form}
              aside={<DraftPreview form={form} planId={plan.id} original={original} />}
              onUrlPasted={ignore}
            />
            <ShopAndName form={form} />
            <Conditions
              form={form}
              plan={plan}
              defaultOpen={original !== undefined}
              campaigns={<Campaigns form={form} plan={plan} />}
            >
              <Details form={form} plan={plan} original={original} />
            </Conditions>
            {original ? null : <CapFlows plan={plan} form={form} />}
          </Flex>
        </Form>
      </Card.Body>
      <Card.Footer>
        <Flex gap="2" flex="1">
          {original ? null : (
            <Button variant="outline" size="lg" flex="1">
              続けて追加
            </Button>
          )}
          <Button colorScheme="primary" size="lg" flex="1">
            {original ? "保存する" : "追加する"}
          </Button>
        </Flex>
      </Card.Footer>
    </Card.Root>
  );
}

/** A new order being added to `plan`: `price` yen at a shop not used yet, `shopName`. */
export function NewOrderFigure({
  plan,
  price,
  shopName,
}: {
  plan: Plan;
  price: number;
  shopName: string;
}) {
  const [input] = useState<OrderFormInput>(() => ({
    ...emptyInputForDate(SAMPLE_TODAY),
    shop: NEW_SHOP,
    newShopName: shopName,
    items: [{ ...emptyItem(), unitPrice: String(price) }],
  }));
  return <OrderEditorSheet plan={plan} original={undefined} input={input} />;
}

/** `order` of `plan` open in the editor, with 「条件」 open. */
export function EditOrderFigure({ plan, order }: { plan: Plan; order: Order }) {
  const shops = useAtomValue(shopsAtom);
  const [input] = useState(() => inputOf(order, shops));
  return <OrderEditorSheet plan={plan} original={order} input={input} />;
}
