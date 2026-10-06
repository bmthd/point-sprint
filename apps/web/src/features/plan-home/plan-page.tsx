import { ClientOnly } from "@tanstack/react-router";
import type { Plan } from "@workspaces/domain";
import { Button, Heading, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { planAtom } from "../../state/derived";
import { plansQueryAtom, shopsQueryAtom } from "../../state/queries";
import { RouterLink } from "../plan-list/router-link";

function NotFound() {
  return (
    <VStack as="main" alignItems="center" gap="4" px="4" py="16" textAlign="center">
      <Heading as="h1" fontSize="lg">
        プランが見つかりません
      </Heading>
      <Text fontSize="sm" color="fg.muted">
        このブラウザに保存されたプランの中に、このリンクのプランはありません。
      </Text>
      <RouterLink to="/" color="link" minH="11" display="flex" alignItems="center">
        プランの一覧へ
      </RouterLink>
    </VStack>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <VStack as="main" alignItems="center" gap="4" px="4" py="16" textAlign="center">
      <Text role="alert">保存されたデータを読み込めませんでした。</Text>
      <Button variant="outline" size="lg" onClick={onRetry}>
        もう一度読み込む
      </Button>
    </VStack>
  );
}

/**
 * Figures need both the plans and the shops: without the shops every order would count as an
 * unknown shop. Until both have loaded nothing is shown.
 */
function PlanScreen({ id, render }: { id: string | undefined; render: (plan: Plan) => ReactNode }) {
  const plan = useAtomValue(planAtom(id ?? ""));
  const plans = useAtomValue(plansQueryAtom);
  const shops = useAtomValue(shopsQueryAtom);
  if (plans.isError || shops.isError) {
    return (
      <LoadError
        onRetry={() => {
          if (plans.isError) void plans.refetch();
          if (shops.isError) void shops.refetch();
        }}
      />
    );
  }
  if (!plans.isSuccess || !shops.isSuccess) {
    return (
      <Text role="status" px="4" py="16" textAlign="center" color="fg.muted">
        読み込み中…
      </Text>
    );
  }
  return plan ? render(plan) : <NotFound />;
}

/**
 * A page of the plan `id`: `render` gets the plan once it and the shops have loaded. The plan
 * lives on this device, so it renders on the client only.
 */
export function PlanPage({
  id,
  render,
}: {
  id: string | undefined;
  render: (plan: Plan) => ReactNode;
}) {
  return (
    <ClientOnly>
      <PlanScreen id={id} render={render} />
    </ClientOnly>
  );
}
