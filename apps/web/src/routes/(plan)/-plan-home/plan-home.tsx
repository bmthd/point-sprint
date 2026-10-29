import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import type { Plan, TaxRate } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  Card,
  Heading,
  Menu,
  VStack,
  useDisclosure,
  useMediaQuery,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../../state/derived";
import { plansAtom } from "../../../state/queries";
import { NEW_ORDER, OrderEditor } from "../-order-editor/order-editor";
import { SettingsPanelButton } from "../-plan-settings/plan-settings";
import { ColumnHead } from "../../../ui/column-head";
import { RouterIconButton } from "../../../ui/router-link";
import { ShareButton } from "../../-share/share-button";
import { planFigures } from "../../-share/result-card";
import { resultShareTarget } from "../../-share/share-target";
import { BottomBar } from "./bottom-bar";
import { CapList } from "./cap-list";
import { useCapLines } from "../-cap-lines";
import { useToday } from "../../-use-today";
import { ChevronIcon, SlidersIcon } from "../../../ui/icons";
import { OrderList } from "./order-list";
import { OrderTable } from "./order-table";
import { PlanPage } from "../-plan-page";
import { PointBreakdown } from "./point-breakdown";
import { ShopLadder } from "./shop-ladder";
import { SummaryCard, countedAmount, effectiveRate } from "./summary-card";
import { Warnings } from "../-warnings";
import { useSpuLossNotice } from "./spu-loss-notice";
import { SpuPanel, useSpuPanelTarget } from "./spu-panel";
import { spuPageFromPlan } from "../-spu-month/spu-from";
import { SpuSettingsCard } from "../-spu-month/spu-month-rows";

/** Same as the `lg` breakpoint: from here the summary is a column to the right of the orders. */
const WIDE = "(min-width: 61em)";
/** From 1024px the orders are the desktop list instead of cards. */
const DESKTOP = "(min-width: 64em)";

function PlanSwitcher({ plan }: { plan: Plan }) {
  const navigate = useNavigate();
  const plans = useAtomValue(plansAtom);
  const others = plans
    .filter((other) => other.id !== plan.id)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return (
    <Box display="flex" alignItems="center" gap="1" minW="0">
      <Heading as="h1" fontSize="md" lineClamp={1}>
        {plan.name}
      </Heading>
      <Menu.Root>
        <Menu.Trigger>
          <Button
            variant="ghost"
            colorScheme="gray"
            size="sm"
            aria-label="プランを切り替える"
            flex="none"
          >
            <ChevronIcon size={16} />
          </Button>
        </Menu.Trigger>
        <Menu.Content>
          {others.map((other) => (
            <Menu.Item
              key={other.id}
              onClick={() => void navigate({ to: "/plan", search: { id: other.id } })}
            >
              {other.name}
            </Menu.Item>
          ))}
          {others.length > 0 ? <Menu.Separator /> : null}
          <Menu.Item onClick={() => void navigate({ to: "/" })}>プランの一覧</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </Box>
  );
}

/** On a desktop the settings open in a side panel; on a phone they are their own page. */
function SettingsEntry({
  plan,
  desktop,
  onChangeSpu,
}: {
  plan: Plan;
  desktop: boolean;
  onChangeSpu: (month: string) => void;
}) {
  const panel = useDisclosure();
  return desktop ? (
    <SettingsPanelButton
      plan={plan}
      open={panel.open}
      onOpen={panel.onOpen}
      onClose={panel.onClose}
      onChangeSpu={onChangeSpu}
    />
  ) : (
    <RouterIconButton
      to="/plan/settings"
      search={{ id: plan.id }}
      aria-label="プランの設定（SPU・上限・キャンペーン）"
      size="lg"
      variant="ghost"
      flex="none"
      icon={<SlidersIcon />}
    />
  );
}

/** The plan's own bar under the site header: which plan this is, and its settings. */
function PlanBar({
  plan,
  desktop,
  onChangeSpu,
}: {
  plan: Plan;
  desktop: boolean;
  onChangeSpu: (month: string) => void;
}) {
  return (
    <Flex
      maxW="1280px"
      mx="auto"
      h="14"
      align="center"
      justify="space-between"
      gap="2"
      pl={{ base: "6", lg: "3" }}
      pr={{ base: "6", lg: "2" }}
    >
      <PlanSwitcher plan={plan} />
      <SettingsEntry plan={plan} desktop={desktop} onChangeSpu={onChangeSpu} />
    </Flex>
  );
}

const Panel = (props: { children: ReactNode; label: string; id?: string }) => (
  <Card.Root as="section" id={props.id} aria-label={props.label}>
    <Card.Body alignItems="stretch">{props.children}</Card.Body>
  </Card.Root>
);

/**
 * The order editor is open while the URL has `edit=` (`new`, or an order id), so the back button
 * closes it. Closing it goes back when this page opened it, and otherwise drops `edit=` in place.
 */
function useOrderEditorTarget(plan: Plan) {
  const planId = plan.id;
  const navigate = useNavigate();
  const router = useRouter();
  const search: { edit?: unknown } = useSearch({ strict: false });
  const openedHere = useRef(false);
  const open = useCallback(
    (target: string) => {
      openedHere.current = true;
      void navigate({ to: "/plan", search: { id: planId, edit: target } });
    },
    [navigate, planId],
  );
  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.history.back();
    } else {
      void navigate({ to: "/plan", search: { id: planId }, replace: true });
    }
  }, [navigate, router, planId]);
  const target = typeof search.edit === "string" ? search.edit : undefined;
  useEffect(() => {
    // Closed by the browser's back button: the next close must not go back again.
    if (target === undefined) openedHere.current = false;
  }, [target]);
  const missing =
    target !== undefined &&
    target !== NEW_ORDER &&
    !plan.orders.some((order) => order.id === target);
  useEffect(() => {
    // `edit=` names an order that is not (or no longer) in the plan: drop it from the URL.
    if (!missing) return;
    openedHere.current = false;
    void navigate({ to: "/plan", search: { id: planId }, replace: true });
  }, [missing, navigate, planId]);
  return { target, open, close };
}

const now = () => new Date();

function Home({ plan }: { plan: Plan }) {
  const result = useAtomValue(planResultAtom(plan.id));
  useSpuLossNotice(plan);
  const wide = useMediaQuery(WIDE);
  const desktop = useMediaQuery(DESKTOP);
  const editor = useOrderEditorTarget(plan);
  const spuPanel = useSpuPanelTarget(plan.id);
  const navigate = useNavigate();
  const settings = useAtomValue(accountSettingsAtom);
  // On a desktop a month's SPU opens in a side panel over the plan; elsewhere it is its own page.
  const changeSpu = (month: string) => {
    if (desktop) spuPanel.open(month);
    else {
      const account = settings.enabled ? accountIdOf(plan, settings) : undefined;
      void navigate(spuPageFromPlan(plan.id, month, account));
    }
  };
  const { open: editOrder } = editor;
  const addOrder = useCallback(() => editOrder(NEW_ORDER), [editOrder]);
  const today = useToday(now);
  const [taxRate, setTaxRate] = useState<TaxRate>(0.1);
  const lines = useCapLines(plan);
  const resultHeadingId = useId();
  if (!result) return null;
  const outlook = result.shopAroundOutlook;
  const capList =
    lines.length === 0 ? null : (
      <Panel id="caps" label="上限までの残り">
        <CapList
          lines={lines}
          today={today}
          period={plan.period}
          taxRate={taxRate}
          onTaxRate={setTaxRate}
        />
      </Panel>
    );
  const shareResult = (
    <ShareButton
      label="結果をシェア"
      target={resultShareTarget(
        planFigures(result, effectiveRate(result.total, countedAmount(plan)), plan.officialEventId),
      )}
    />
  );

  return (
    <>
      <PlanBar plan={plan} desktop={desktop} onChangeSpu={changeSpu} />
      {/* One column on a phone (summary first); on a wide screen the summary is the right column. */}
      <Box
        as="main"
        maxW="1280px"
        mx="auto"
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr) 360px", lg: "minmax(0, 1fr)" }}
        alignItems="start"
        gap={{ base: "6", lg: "4" }}
        px={{ base: "6", lg: "4" }}
        pt={{ base: "6", lg: "1" }}
        pb={{ base: "8", lg: "32" }}
      >
        <VStack
          as="aside"
          aria-label={wide ? undefined : "結果"}
          aria-labelledby={wide ? resultHeadingId : undefined}
          gap="2.5"
          alignItems="stretch"
          gridColumn={{ base: "2", lg: "1" }}
          gridRow="1"
        >
          {/* As the orders do, the column starts with its heading, so the two columns' cards start on one line. */}
          {wide ? (
            <ColumnHead>
              <Heading as="h2" id={resultHeadingId} fontSize="md">
                結果
              </Heading>
            </ColumnHead>
          ) : null}
          <VStack gap="4" alignItems="stretch">
            <SummaryCard plan={plan} result={result} compact={!wide} lines={lines} />
            <SpuSettingsCard
              plan={plan}
              title="SPU の設定"
              note="注文の日付の月で決まります"
              onChange={changeSpu}
            />
            <Warnings plan={plan} warnings={result.warnings} hasShopAround={outlook !== null} />
            {wide ? capList : null}
            {wide ? (
              <Panel label="ポイントの内訳">
                <Heading as="h3" fontSize="sm">
                  ポイントの内訳
                </Heading>
                <PointBreakdown totals={result.groupTotals} />
              </Panel>
            ) : null}
            {wide && outlook ? (
              <Panel label="あと何店舗回る？">
                <ShopLadder outlook={outlook} />
              </Panel>
            ) : null}
            {wide ? shareResult : null}
          </VStack>
        </VStack>
        <Box
          as="section"
          id="orders"
          aria-label="注文のリスト"
          gridColumn="1"
          gridRow={{ base: "1", lg: "2" }}
          minW="0"
        >
          {desktop ? (
            <OrderTable plan={plan} onEdit={editOrder} onSpu={changeSpu} />
          ) : (
            <OrderList
              plan={plan}
              onEdit={editOrder}
              onAdd={wide ? addOrder : undefined}
              onSpu={changeSpu}
            />
          )}
        </Box>
        {/* On a phone the caps and the share button come after the orders; on a wide screen they are in the right column. */}
        {wide ? null : (
          <VStack gridColumn="1" gridRow="3" gap="6" alignItems="stretch">
            {capList}
            {shareResult}
          </VStack>
        )}
      </Box>
      {wide ? null : <BottomBar plan={plan} result={result} onAdd={addOrder} />}
      <OrderEditor
        plan={plan}
        target={editor.target}
        layout={desktop ? "dialog" : "sheet"}
        onClose={editor.close}
      />
      <SpuPanel
        plan={plan}
        month={desktop ? spuPanel.target : undefined}
        onMonth={spuPanel.show}
        onClose={spuPanel.close}
      />
    </>
  );
}

/** The plan's home at `/plan?id=`. */
export function PlanHome({ id }: { id: string | undefined }) {
  return <PlanPage id={id} title={(plan) => plan.name} render={(plan) => <Home plan={plan} />} />;
}
