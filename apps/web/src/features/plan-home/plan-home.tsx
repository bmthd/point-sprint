import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import type { Plan } from "@workspaces/domain";
import {
  Box,
  Button,
  Card,
  Heading,
  Menu,
  Text,
  VStack,
  useDisclosure,
  useMediaQuery,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { planResultAtom } from "../../state/derived";
import { plansAtom } from "../../state/queries";
import { NEW_ORDER, OrderEditor } from "../order-editor/order-editor";
import { SettingsPanelButton } from "../plan-settings/plan-settings";
import { RouterLink } from "../../ui/router-link";
import { ShareButton } from "../share/share-button";
import { planFigures } from "../share/result-card";
import { resultShareTarget } from "../share/share-target";
import { BottomBar } from "./bottom-bar";
import { ChevronIcon, SlidersIcon } from "../../ui/icons";
import { OrderList } from "./order-list";
import { OrderTable } from "./order-table";
import { PlanPage } from "./plan-page";
import { PointBreakdown } from "./point-breakdown";
import { ShopLadder } from "./shop-ladder";
import { SummaryCard, countedAmount, effectiveRate } from "./summary-card";
import { Warnings } from "./warnings";

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
    <Menu.Root>
      <Menu.Trigger>
        <Button
          variant="ghost"
          colorScheme="gray"
          size="lg"
          aria-label={`${plan.name}、プランを切り替える`}
          minW="0"
          textAlign="start"
        >
          <Text as="span" fontSize="md" fontWeight="bold" lineClamp={1}>
            {plan.name}
          </Text>
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
  );
}

/** On a desktop the settings open in a side panel; on a phone they are their own page. */
function SettingsEntry({ plan, desktop }: { plan: Plan; desktop: boolean }) {
  const panel = useDisclosure();
  return desktop ? (
    <SettingsPanelButton
      plan={plan}
      open={panel.open}
      onOpen={panel.onOpen}
      onClose={panel.onClose}
    />
  ) : (
    <RouterLink
      to="/plan/settings"
      search={{ id: plan.id }}
      aria-label="プランの設定（SPU・上限・キャンペーン）"
      boxSize="11"
      flex="none"
      display="flex"
      alignItems="center"
      justifyContent="center"
      rounded="xl"
      color="fg"
      _hover={{ bg: "bg.muted" }}
    >
      <SlidersIcon />
    </RouterLink>
  );
}

/** The plan's own bar under the site header: which plan this is, and its settings. */
function PlanBar({ plan, desktop }: { plan: Plan; desktop: boolean }) {
  return (
    <Box
      maxW="1280px"
      mx="auto"
      h="14"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="2"
      pl={{ base: "6", lg: "3" }}
      pr={{ base: "6", lg: "2" }}
    >
      <PlanSwitcher plan={plan} />
      <SettingsEntry plan={plan} desktop={desktop} />
    </Box>
  );
}

const Panel = (props: { children: ReactNode; label: string }) => (
  <Card.Root as="section" aria-label={props.label} variant="outline">
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

function Home({ plan }: { plan: Plan }) {
  const result = useAtomValue(planResultAtom(plan.id));
  const wide = useMediaQuery(WIDE);
  const desktop = useMediaQuery(DESKTOP);
  const editor = useOrderEditorTarget(plan);
  const { open: editOrder } = editor;
  const addOrder = useCallback(() => editOrder(NEW_ORDER), [editOrder]);
  if (!result) return null;
  const outlook = result.shopAroundOutlook;
  const shareResult = (
    <ShareButton
      label="結果をシェア"
      target={resultShareTarget(
        planFigures(result.total, effectiveRate(result.total, countedAmount(plan))),
      )}
    />
  );

  return (
    <>
      <PlanBar plan={plan} desktop={desktop} />
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
          aria-label="結果"
          gap="4"
          alignItems="stretch"
          gridColumn={{ base: "2", lg: "1" }}
          gridRow="1"
        >
          <SummaryCard plan={plan} result={result} compact={!wide} />
          <Warnings plan={plan} warnings={result.warnings} hasShopAround={outlook !== null} />
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
        <Box
          as="section"
          id="orders"
          aria-label="注文のリスト"
          gridColumn="1"
          gridRow={{ base: "1", lg: "2" }}
          minW="0"
        >
          {desktop ? (
            <OrderTable plan={plan} onEdit={editOrder} />
          ) : (
            <OrderList plan={plan} onEdit={editOrder} onAdd={wide ? addOrder : undefined} />
          )}
        </Box>
        {/* On a phone the share button comes after the orders; on a wide screen it ends the right column. */}
        {wide ? null : (
          <Box gridColumn="1" gridRow="3">
            {shareResult}
          </Box>
        )}
      </Box>
      {wide ? null : <BottomBar plan={plan} result={result} onAdd={addOrder} />}
      <OrderEditor
        plan={plan}
        target={editor.target}
        layout={desktop ? "dialog" : "sheet"}
        onClose={editor.close}
      />
    </>
  );
}

/** The plan's home at `/plan?id=`. */
export function PlanHome({ id }: { id: string | undefined }) {
  return <PlanPage id={id} title={(plan) => plan.name} render={(plan) => <Home plan={plan} />} />;
}
