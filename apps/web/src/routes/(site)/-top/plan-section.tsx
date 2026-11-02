import { grouped } from "../../../ui/format";
import { RouterLink } from "../../../ui/router-link";
import type { Plan } from "@workspaces/domain";
import {
  Button,
  Drawer,
  Flex,
  Card,
  Heading,
  IconButton,
  List,
  type ListItemProps,
  Modal,
  Text,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId, useRef, useState } from "react";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../../state/derived";
import { deletePlanAtom } from "../../../state/mutations";
import { plansAtom } from "../../../state/queries";
import { formatPeriod } from "../../../ui/dates";

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

/**
 * A plan's row, a link to it with its total, and its delete button. The `featured` one, the latest,
 * is the red card with its total large.
 */
function PlanRow({
  plan,
  onDelete,
  featured = false,
  ...rest
}: { plan: Plan; onDelete: (plan: Plan) => void; featured?: boolean } & ListItemProps) {
  const result = useAtomValue(planResultAtom(plan.id));
  const settings = useAtomValue(accountSettingsAtom);
  const accountId = accountIdOf(plan, settings);
  const account = settings.enabled
    ? settings.accounts.find((candidate) => candidate.id === accountId)
    : undefined;
  return (
    <List.Item {...rest}>
      <Card.Root
        variant={featured ? "solid" : undefined}
        colorScheme={featured ? "primary" : undefined}
      >
        <Card.Body flexDirection="row" alignItems="center">
          <RouterLink
            to="/plan"
            search={{ id: plan.id }}
            colorScheme="mono"
            color={featured ? "inherit" : undefined}
            flex="1"
            minW="0"
            display="flex"
            alignItems={featured ? "flex-end" : "center"}
            gap="3"
          >
            <Flex flex="1" minW="0" direction="column" gap="0.5">
              <Text fontSize={featured ? "sm" : "md"} fontWeight="bold" lineClamp={1}>
                {plan.name}
              </Text>
              <Text
                fontSize="xs"
                color={featured ? "primary.contrast/80" : "fg.muted"}
                fontVariantNumeric="tabular-nums"
              >
                {account ? `${account.name}・` : null}
                {formatPeriod(plan.period)}・{result?.shopCount ?? 0}店舗・{plan.orders.length}件
              </Text>
            </Flex>
            <Text
              fontSize={featured ? "4xl" : "lg"}
              lineHeight={featured ? "1" : undefined}
              fontWeight="bold"
              fontVariantNumeric="tabular-nums"
            >
              {grouped(result?.total ?? 0)}P
            </Text>
          </RouterLink>
          <IconButton
            variant="ghost"
            colorScheme={featured ? "mono" : "danger"}
            color={featured ? "primary.contrast" : undefined}
            size="lg"
            aria-label={`${plan.name}を削除`}
            onClick={() => onDelete(plan)}
          >
            <TrashIcon />
          </IconButton>
        </Card.Body>
      </Card.Root>
    </List.Item>
  );
}

/** How many of the latest plans the top page lists on a wide screen; a phone lists the latest. */
const SHOWN = 3;

/**
 * The visitor's plans, the latest first, in the sample's place beside the hero: the latest large,
 * the next ones under it, and all of them behind 「すべてのプラン」. Plans live on this device, so
 * this section only renders on the client.
 */
export function PlanSection() {
  const plans = useAtomValue(plansAtom);
  const { mutate: deletePlan } = useAtomValue(deletePlanAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const all = useDisclosure();
  const [target, setTarget] = useState<Plan>();
  const finalFocus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const sorted = [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  // Nothing to show until there is a plan: the sample takes its place.
  if (sorted.length === 0) return null;

  const onDelete = (next: Plan) => {
    setTarget(next);
    finalFocus.current = null;
    onOpen();
  };

  return (
    <VStack as="section" aria-labelledby={headingId} gap="2.5" alignItems="stretch">
      <Heading as="h2" id={headingId} fontSize="sm" ref={heading} tabIndex={-1}>
        自分のプラン
      </Heading>
      <List.Root gap="2.5">
        {sorted.slice(0, SHOWN).map((plan, index) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            featured={index === 0}
            // A phone lists the latest alone.
            display={index === 0 ? undefined : { base: "list-item", md: "none" }}
            onDelete={onDelete}
          />
        ))}
      </List.Root>
      {sorted.length > 1 ? (
        <Button
          variant="ghost"
          colorScheme="link"
          alignSelf="flex-end"
          display={sorted.length > SHOWN ? undefined : { base: "none", md: "inline-flex" }}
          onClick={all.onOpen}
        >
          すべてのプラン（{sorted.length} 件）
        </Button>
      ) : null}
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
              {sorted.map((plan) => (
                <PlanRow key={plan.id} plan={plan} onDelete={onDelete} />
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
        onCancel={onClose}
        onSuccess={() => {
          if (target) deletePlan(target.id);
          onClose();
          // The delete button is gone, so the dialog cannot hand focus back to it. With the last
          // plan the section goes too, so focus moves to the events below.
          finalFocus.current =
            plans.length > 1 ? heading.current : document.querySelector<HTMLElement>("#events h2");
        }}
      />
    </VStack>
  );
}
