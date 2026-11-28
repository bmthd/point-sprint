import { selectAtom } from "jotai/utils";
import { plansAtom } from "#/state/query-atoms.ts";
import { grouped } from "#/ui/format.ts";
import { RouterLink } from "#/ui/router-link.tsx";
import { PlanHoldBadge } from "#/routes/-plan-hold-badge.tsx";
import { capLines, accountIdOf, type Plan, deepEqual } from "@workspaces/domain";
import {
  Badge,
  Button,
  Drawer,
  Flex,
  Card,
  Heading,
  IconButton,
  List,
  Modal,
  Text,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";

import {
  accountSettingsAtom,
  calculatedPlanAtom,
  planAtom,
  planResultAtom,
} from "#/state/derived.ts";
import { runDeletePlanAtom } from "#/state/mutations.ts";
import { formatPeriod } from "#/ui/dates.ts";
import { ResultCard } from "./result-card.tsx";

function TrashIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

/** 「メイン・10/1〜10/31・1店舗・2件」: the plan's account when accounts are told apart, its period and size. */
function useMeta(planId: string): string {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const settings = useAtomValue(accountSettingsAtom);
  if (!plan) return "";
  const accountId = accountIdOf(plan, settings);
  const account = settings.enabled
    ? settings.accounts.find((candidate) => candidate.id === accountId)
    : undefined;
  return `${account ? `${account.name}・` : ""}${formatPeriod(plan.period)}・${result?.shopCount ?? 0}店舗・${plan.orders.length}件`;
}

function DeleteButton({
  planId,
  onDelete,
}: {
  planId: string;
  onDelete: (planId: string) => void;
}) {
  const plan = useAtomValue(planAtom(planId));
  if (!plan) return null;
  return (
    <IconButton
      variant="ghost"
      colorScheme="danger"
      size="lg"
      aria-label={`${plan.name}を削除`}
      onClick={() => onDelete(planId)}
    >
      <TrashIcon />
    </IconButton>
  );
}

/** A plan's row in the list of all plans: a link to it with its total, and its delete button. */
function PlanRow({ planId, onDelete }: { planId: string; onDelete: (planId: string) => void }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const meta = useMeta(planId);
  if (!plan) return null;
  return (
    <List.Item>
      <Card.Root>
        <Card.Body flexDirection="row" alignItems="center">
          <RouterLink
            to="/plan"
            search={{ id: plan.id }}
            colorScheme="mono"
            flex="1"
            minW="0"
            display="flex"
            alignItems="center"
            gap="3"
          >
            <Flex flex="1" minW="0" direction="column" gap="0.5">
              <Flex align="center" gap="2">
                <Text fontWeight="bold" lineClamp={1} minW="0">
                  {plan.name}
                </Text>
                <PlanHoldBadge planId={planId} />
              </Flex>
              <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                {meta}
              </Text>
            </Flex>
            <Text fontSize="lg" fontWeight="bold" fontVariantNumeric="tabular-nums">
              {grouped(result?.total ?? 0)}P
            </Text>
          </RouterLink>
          <DeleteButton planId={planId} onDelete={onDelete} />
        </Card.Body>
      </Card.Root>
    </List.Item>
  );
}

/** The latest plan, in the sample's card: what a visitor sees before having a plan. */
function LatestPlan({
  planId,
  heading,
  action,
}: {
  planId: string;
  heading: ReactNode;
  action: ReactNode;
}) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const calculated = useAtomValue(calculatedPlanAtom(planId));
  const meta = useMeta(planId);
  const outlook = result?.shopAroundOutlook ?? null;
  const capRemaining = useMemo(() => {
    if (!result || !calculated || !outlook) return null;
    const line = capLines(calculated, result).find(
      (candidate) => candidate.benefit.id === outlook.benefitId,
    );
    return line ? line.remaining : null;
  }, [calculated, outlook, result]);
  if (!plan) return null;
  return (
    <ResultCard
      label={heading}
      title={
        <Flex as="span" align="center" gap="2">
          <RouterLink
            to="/plan"
            search={{ id: plan.id }}
            colorScheme="mono"
            display="block"
            minW="0"
            truncated
          >
            {plan.name}
          </RouterLink>
          <PlanHoldBadge planId={planId} />
        </Flex>
      }
      meta={meta}
      action={action}
      total={result?.total ?? 0}
      capRemaining={capRemaining}
      totals={result?.groupTotals ?? { base: 0, spu: 0, marathon: 0, campaign: 0 }}
      shopCount={outlook ? outlook.shopCount : null}
      nextShopRate={outlook?.nextShop?.rateDelta ?? null}
    />
  );
}

/**
 * The visitor's latest plan, in the sample's place beside the hero, and all of them, each with its
 * delete button, behind 「すべてのプラン」. Plans live on this device, so this section only renders on the client.
 */
export function PlanSection() {
  const planIds = useAtomValue(selectAtom(plansAtom, recentPlanIds, deepEqual));
  const deletePlan = useSetAtom(runDeletePlanAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const all = useDisclosure();
  const [targetId, setTarget] = useState<string>();
  const target = useAtomValue(planAtom(targetId ?? ""));
  const finalFocus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const latest = planIds[0];
  // Nothing to show until there is a plan: the sample takes its place.
  if (!latest) return null;

  const onDelete = (next: string) => {
    setTarget(next);
    finalFocus.current = null;
    onOpen();
  };

  return (
    <VStack as="section" aria-labelledby={headingId} alignItems="stretch">
      <LatestPlan
        planId={latest}
        // Managing the plans, deleting one among them, is in the list of all of them.
        action={
          <Button
            variant="ghost"
            colorScheme="link"
            size="xs"
            flexShrink="0"
            aria-label={`すべてのプラン（${planIds.length} 件）`}
            onClick={all.onOpen}
          >
            すべて（{planIds.length} 件）
          </Button>
        }
        heading={
          <Badge colorScheme="mono" variant="solid" rounded="full">
            <Heading as="h2" id={headingId} fontSize="inherit" ref={heading} tabIndex={-1}>
              自分のプラン
            </Heading>
          </Badge>
        }
      />
      <Drawer.Root
        open={all.open}
        onClose={all.onClose}
        placement={{ base: "inline-end", md: "block-end" }}
        size="lg"
      >
        <Drawer.Content
          bg="bg.base"
          maxH={{ base: "none", md: "calc(100dvh - 24px)" }}
          roundedTop={{ base: "0", md: "l2" }}
        >
          <Drawer.Header bg="bg.panel" borderBottomWidth="1px">
            <Drawer.Title fontSize="md">すべてのプラン</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body py="4">
            <List.Root gap="2.5">
              {planIds.map((planId) => (
                <PlanRow key={planId} planId={planId} onDelete={onDelete} />
              ))}
            </List.Root>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
      <Modal.Root
        open={open}
        title="プランを削除しますか？"
        body={
          <Text>「{target?.name}」と、その注文はすべて消えます。この操作は取り消せません。</Text>
        }
        cancel="キャンセル"
        success={{ children: "削除する", colorScheme: "danger" }}
        finalFocusRef={finalFocus}
        onClose={onClose}
        onSuccess={() => {
          if (target) deletePlan(target.id);
          onClose();
          // The delete button is gone, so the dialog cannot hand focus back to it. With the last
          // plan the section goes too, so focus moves to the events below.
          finalFocus.current =
            planIds.length > 1
              ? heading.current
              : document.querySelector<HTMLElement>("#events h2");
        }}
      />
    </VStack>
  );
}

const recentPlanIds = (plans: Plan[]) =>
  [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map(({ id }) => id);
