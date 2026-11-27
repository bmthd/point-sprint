import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import type { TaxRate } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  Card,
  Heading,
  Menu,
  VStack,
  useDisclosure,
  useBreakpointValue,
  ChevronDownIcon,
  SlidersHorizontalIcon,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  bigOneMoreShopGainAtom,
  planResultAtom,
  planAtom,
  planCapLinesAtom,
  planNameAtom,
  planPeriodAtom,
  hasPlanResultAtom,
  hasOrderAtom,
  recentPlanNamesAtom,
  planGroupTotalsAtom,
  planShopOutlookAtom,
} from "#/state/derived.ts";
import { PlanHoldBadge } from "#/routes/-plan-hold-badge.tsx";
import { NEW_ORDER, OrderEditor } from "#/routes/(plan)/-order-editor/order-editor.tsx";
import { eventChangeRequestAtom } from "#/routes/(plan)/-plan-settings/event-attacher.tsx";
import { SettingsPanelButton } from "#/routes/(plan)/-plan-settings/plan-settings.tsx";
import { ColumnHead } from "#/ui/column-head.tsx";
import { RouterIconButton } from "#/ui/router-link.tsx";
import { ShareButton } from "#/routes/-share/share-button.tsx";
import { planFigures } from "#/routes/-share/result-card.ts";
import { resultShareTarget } from "#/routes/-share/share-target.ts";
import { BottomBar } from "./bottom-bar.tsx";
import { CarryOverNotice } from "./carry-over-notice.tsx";
import { CapList } from "./cap-list.tsx";
import { useToday } from "#/routes/-use-today.ts";
import { OrderList } from "./order-list.tsx";
import { OrderTable } from "./order-table.tsx";
import { PlanPage } from "#/routes/(plan)/-plan-page.tsx";
import { PointBreakdown } from "#/routes/-point-breakdown.tsx";
import { ShopLadder } from "./shop-ladder.tsx";
import { SummaryCard, countedAmount, effectiveRate } from "./summary-card.tsx";
import { Warnings } from "#/routes/(plan)/-warnings.tsx";
import { useSpuLossNotice } from "#/routes/(plan)/-spu-loss-notice.tsx";
import { SpuPanel, useSpuPanelTarget } from "./spu-panel.tsx";
import { spuPageFromPlanAtom } from "#/routes/(plan)/-spu-month/spu-from.ts";
import { SpuSettingsCard } from "#/routes/(plan)/-spu-month/spu-month-rows.tsx";

function PlanSwitcher({ planId }: { planId: string }) {
  const navigate = useNavigate();
  const name = useAtomValue(planNameAtom(planId));
  const plans = useAtomValue(recentPlanNamesAtom);
  const others = plans.filter((other) => other.id !== planId);
  return (
    <Box display="flex" alignItems="center" gap="1" minW="0">
      <Heading as="h1" fontSize="md" lineClamp={1}>
        {name}
      </Heading>
      <PlanHoldBadge planId={planId} />
      <Menu.Root>
        <Menu.Trigger>
          <Button
            variant="ghost"
            colorScheme="gray"
            size="sm"
            aria-label="プランを切り替える"
            flex="none"
          >
            <ChevronDownIcon />
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

/**
 * The plan's own bar under the site header, while the screen is one column: which plan this is,
 * and its settings, their own page. Two columns start with these instead.
 */
function PlanBar({ planId }: { planId: string }) {
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
      <PlanSwitcher planId={planId} />
      <RouterIconButton
        to="/plan/settings"
        search={{ id: planId }}
        aria-label="プランの設定（SPU・上限・キャンペーン）"
        size="lg"
        variant="ghost"
        flex="none"
        icon={<SlidersHorizontalIcon />}
      />
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
function useOrderEditorTarget(planId: string) {
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
  const exists = useAtomValue(hasOrderAtom({ planId, orderId: target ?? "" }));
  const missing = target !== undefined && target !== NEW_ORDER && !exists;
  useEffect(() => {
    // `edit=` names an order that is not (or no longer) in the plan: drop it from the URL.
    if (!missing) return;
    openedHere.current = false;
    void navigate({ to: "/plan", search: { id: planId }, replace: true });
  }, [missing, navigate, planId]);
  return { target, open, close };
}

const now = () => new Date();

function SpuLossNotice({ planId }: { planId: string }) {
  useSpuLossNotice(planId);
  return null;
}

function PlanSummary({ planId, compact }: { planId: string; compact: boolean }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const lines = useAtomValue(planCapLinesAtom(planId));
  const today = useToday(now);
  const gain = useAtomValue(bigOneMoreShopGainAtom({ planId, today }));
  if (!plan || !result) return null;
  return (
    <SummaryCard
      plan={plan}
      result={result}
      compact={compact}
      lines={lines}
      oneMoreShopGain={gain}
    />
  );
}

function PlanCaps({ planId, table }: { planId: string; table: boolean }) {
  const period = useAtomValue(planPeriodAtom(planId));
  const lines = useAtomValue(planCapLinesAtom(planId));
  const today = useToday(now);
  const [taxRate, setTaxRate] = useState<TaxRate>(0.1);
  if (!period || lines.length === 0) return null;
  return (
    <Panel id="caps" label="上限までの残り">
      <CapList
        lines={lines}
        today={today}
        period={period}
        taxRate={taxRate}
        onTaxRate={setTaxRate}
        table={table}
      />
    </Panel>
  );
}

function PlanWarnings({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  if (!plan || !result) return null;
  return (
    <Warnings
      plan={plan}
      warnings={result.warnings}
      hasShopAround={result.shopAroundOutlook !== null}
    />
  );
}

function PlanShareButton({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  if (!plan || !result) return null;
  return (
    <ShareButton
      label="結果をシェア"
      target={resultShareTarget(
        planFigures(result, effectiveRate(result.total, countedAmount(plan)), plan.officialEventId),
      )}
    />
  );
}

function PlanBreakdown({ planId }: { planId: string }) {
  const totals = useAtomValue(planGroupTotalsAtom(planId));
  if (!totals) return null;
  return (
    <Panel label="ポイントの内訳">
      <Heading as="h3" fontSize="sm">
        ポイントの内訳
      </Heading>
      <PointBreakdown totals={totals} />
    </Panel>
  );
}

function PlanShopLadder({ planId }: { planId: string }) {
  const outlook = useAtomValue(planShopOutlookAtom(planId));
  if (!outlook) return null;
  return (
    <Panel label="あと何店舗回る？">
      <ShopLadder outlook={outlook} />
    </Panel>
  );
}

function PlanBottomBar({ planId, onAdd }: { planId: string; onAdd: () => void }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const today = useToday(now);
  const gain = useAtomValue(bigOneMoreShopGainAtom({ planId, today }));
  if (!plan || !result) return null;
  return <BottomBar plan={plan} result={result} onAdd={onAdd} oneMoreShopGain={gain} />;
}

function PlanCarryOverNotice({ planId, onCarryOver }: { planId: string; onCarryOver: () => void }) {
  const plan = useAtomValue(planAtom(planId));
  const today = useToday(now);
  return plan ? <CarryOverNotice plan={plan} today={today} onCarryOver={onCarryOver} /> : null;
}

function Home({ planId }: { planId: string }) {
  const hasResult = useAtomValue(hasPlanResultAtom(planId));
  // Wider than the `lg` breakpoint, which keeps one column: the summary is a column to the right of
  // the orders, the orders are a table, and the settings and a month's SPU open in a side panel.
  const wide = useBreakpointValue({ base: true, lg: false });
  const editor = useOrderEditorTarget(planId);
  const spuPanel = useSpuPanelTarget(planId);
  const navigate = useNavigate();
  const spuPage = useSetAtom(spuPageFromPlanAtom);
  // On a wide screen a month's SPU opens in a side panel over the plan; elsewhere it is its own page.
  const { open: openSpu } = spuPanel;
  const changeSpu = useCallback(
    (month: string) => {
      if (wide) openSpu(month);
      else {
        void navigate(spuPage(planId, month));
      }
    },
    [wide, openSpu, navigate, spuPage, planId],
  );
  const settingsPanel = useDisclosure();
  // A month's SPU opened from the settings goes back to them when it is closed, however it is.
  const [spuFromSettings, setSpuFromSettings] = useState(false);
  const changeSpuFromSettings = (month: string) => {
    setSpuFromSettings(true);
    spuPanel.open(month);
  };
  const [shownSpu, setShownSpu] = useState(spuPanel.target);
  if (spuPanel.target !== shownSpu) {
    setShownSpu(spuPanel.target);
    // A month to none is the panel closing; right after 変更 the URL has no month yet either.
    if (spuPanel.target === undefined && spuFromSettings) {
      setSpuFromSettings(false);
      settingsPanel.onOpen();
    }
  }
  const { open: editOrder } = editor;
  const addOrder = useCallback(() => editOrder(NEW_ORDER), [editOrder]);
  const requestEventChange = useSetAtom(eventChangeRequestAtom);
  // The settings open with the card of the plan's event opened: in the side panel on a wide screen, else their own page.
  const carryOver = () => {
    requestEventChange(true);
    if (wide) settingsPanel.onOpen();
    // The card scrolls itself into view, which resetting the scroll would undo.
    else void navigate({ to: "/plan/settings", search: { id: planId }, resetScroll: false });
  };
  const resultHeadingId = useId();
  if (!hasResult) return null;
  const capList = <PlanCaps planId={planId} table={wide} />;
  const warnings = <PlanWarnings planId={planId} />;
  const shareResult = <PlanShareButton planId={planId} />;

  return (
    <>
      {/* On a wide screen the plan's name heads the orders' column and its settings the result's. */}
      {wide ? null : <PlanBar planId={planId} />}
      <Box
        maxW="1280px"
        mx="auto"
        px={{ base: "6", lg: "4" }}
        pt={{ base: "6", lg: "1" }}
        _empty={{ display: "none" }}
      >
        <PlanCarryOverNotice planId={planId} onCarryOver={carryOver} />
      </Box>
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
              <SettingsPanelButton
                planId={planId}
                open={settingsPanel.open}
                onOpen={settingsPanel.onOpen}
                onClose={settingsPanel.onClose}
                onChangeSpu={changeSpuFromSettings}
              />
            </ColumnHead>
          ) : null}
          <VStack gap="4" alignItems="stretch">
            <PlanSummary planId={planId} compact={!wide} />
            <SpuSettingsCard
              planId={planId}
              title="SPU の設定"
              note="注文の日付の月で決まります"
              onChange={changeSpu}
            />
            {wide ? <PlanBreakdown planId={planId} /> : null}
            {wide ? <PlanShopLadder planId={planId} /> : null}
            {wide ? null : warnings}
            {wide ? shareResult : null}
          </VStack>
        </VStack>
        <Box gridColumn="1" gridRow={{ base: "1", lg: "2" }} minW="0">
          <Box as="section" id="orders" aria-label="注文のリスト">
            {wide ? (
              <OrderTable
                planId={planId}
                head={<PlanSwitcher planId={planId} />}
                onSpu={changeSpu}
              />
            ) : (
              <OrderList planId={planId} onEdit={editOrder} onSpu={changeSpu} />
            )}
          </Box>
          {/* On a wide screen the warnings are about the orders, so they sit under them, and the caps
              after them, where there is room for their table. */}
          {wide ? (
            <VStack mt="4" gap="4" alignItems="stretch">
              {warnings}
              {capList}
            </VStack>
          ) : null}
        </Box>
        {/* On a phone the caps and the share button come after the orders; on a wide screen the caps are under the orders and the share button in the right column. */}
        {wide ? null : (
          <VStack gridColumn="1" gridRow="3" gap="6" alignItems="stretch">
            {capList}
            {shareResult}
          </VStack>
        )}
      </Box>
      {wide ? null : <PlanBottomBar planId={planId} onAdd={addOrder} />}
      <SpuLossNotice planId={planId} />
      <OrderEditor
        planId={planId}
        target={editor.target}
        layout={wide ? "dialog" : "sheet"}
        onClose={editor.close}
      />
      <SpuPanel
        planId={planId}
        month={wide ? spuPanel.target : undefined}
        onMonth={spuPanel.show}
        onClose={spuPanel.close}
        backTo={spuFromSettings ? "プランの設定" : undefined}
      />
    </>
  );
}

/** The plan's home at `/plan?id=`. */
export function PlanHome({ id }: { id: string | undefined }) {
  return <PlanPage id={id} title={(name) => name} render={(planId) => <Home planId={planId} />} />;
}
