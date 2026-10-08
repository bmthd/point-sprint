import { RouterLink } from "../../router-link";
import type { Plan } from "@workspaces/domain";
import { Box, Card, Heading, IconButton, Modal, Text, VStack, useDisclosure } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import { accountIdOf } from "../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../state/derived";
import { deletePlanAtom } from "../../state/mutations";
import { plansAtom, plansQueryAtom } from "../../state/queries";
import { formatPeriod } from "./dates";

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

function PlanRow({ plan, onDelete }: { plan: Plan; onDelete: (plan: Plan) => void }) {
  const result = useAtomValue(planResultAtom(plan.id));
  const settings = useAtomValue(accountSettingsAtom);
  const accountId = accountIdOf(plan, settings);
  const account = settings.enabled
    ? settings.accounts.find((candidate) => candidate.id === accountId)
    : undefined;
  return (
    <Card.Root as="li">
      <Card.Body flexDirection="row" alignItems="center">
        <RouterLink to="/plan" search={{ id: plan.id }} colorScheme="mono" flex="1" minW="0">
          <Box flex="1" minW="0" display="flex" flexDirection="column" gap="0.5">
            <Text fontSize="md" fontWeight="bold" lineClamp={1}>
              {plan.name}
            </Text>
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              {account ? `${account.name}・` : null}
              {formatPeriod(plan.period)}・{result?.shopCount ?? 0}店舗・{plan.orders.length}件
            </Text>
          </Box>
          <Text fontSize="lg" fontWeight="bold" fontVariantNumeric="tabular-nums">
            {(result?.total ?? 0).toLocaleString("ja-JP")}P
          </Text>
        </RouterLink>
        <IconButton
          variant="ghost"
          colorScheme="danger"
          size="lg"
          aria-label={`${plan.name}を削除`}
          onClick={() => onDelete(plan)}
        >
          <TrashIcon />
        </IconButton>
      </Card.Body>
    </Card.Root>
  );
}

/** Plans live on this device, so this section only renders on the client. */
export function PlanSection() {
  const plans = useAtomValue(plansAtom);
  const { isSuccess } = useAtomValue(plansQueryAtom);
  const { mutate: deletePlan } = useAtomValue(deletePlanAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const [target, setTarget] = useState<Plan>();
  const finalFocus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const sorted = [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <VStack as="section" gap="2.5" alignItems="stretch">
      <Heading as="h2" fontSize="md" ref={heading} tabIndex={-1}>
        プラン
      </Heading>
      {isSuccess && sorted.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          まだプランがありません。上のボタンから作れます。
        </Text>
      ) : (
        <VStack as="ul" listStyle="none" m="0" p="0" gap="2.5" alignItems="stretch">
          {sorted.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              onDelete={(next) => {
                setTarget(next);
                finalFocus.current = null;
                onOpen();
              }}
            />
          ))}
        </VStack>
      )}
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
          // The delete button is gone, so the dialog cannot hand focus back to it.
          finalFocus.current = heading.current;
        }}
      />
    </VStack>
  );
}
