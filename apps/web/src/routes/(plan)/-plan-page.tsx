import { ClientOnly } from "@tanstack/react-router";
import { Button, Heading, Text, VStack } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import type { ReactNode } from "react";
import { useClientTitle } from "#/page-head.ts";
import { planNameAtom } from "#/state/derived.ts";
import { planPageLoadStateAtom, retryPlanPageLoadAtom } from "#/state/query-atoms.ts";
import { RouterLink } from "#/ui/router-link.tsx";

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
      <Button variant="outline" bg="bg.panel" size="lg" onClick={onRetry}>
        もう一度読み込む
      </Button>
    </VStack>
  );
}

/**
 * Figures need both the plans and the shops: without the shops every order would count as an
 * unknown shop. Until both have loaded nothing is shown.
 */
function PlanScreen({ id, title, render }: PlanPageProps) {
  const name = useAtomValue(planNameAtom(id ?? ""));
  const loadState = useAtomValue(planPageLoadStateAtom);
  const retry = useSetAtom(retryPlanPageLoadAtom);
  useClientTitle(name === undefined ? undefined : title(name));
  if (loadState === "error") return <LoadError onRetry={retry} />;
  if (loadState === "loading") {
    return (
      <Text role="status" px="4" py="16" textAlign="center" color="fg.muted">
        読み込み中…
      </Text>
    );
  }
  return name !== undefined && id !== undefined ? render(id) : <NotFound />;
}

type PlanPageProps = {
  id: string | undefined;
  /** The page's name with the plan in it, put in the tab once the plan has loaded. */
  title: (name: string) => string;
  render: (planId: string) => ReactNode;
};

/**
 * A page of the plan `id`: `render` gets the plan id once it and the shops have loaded. The plan
 * lives on this device, so it renders on the client only.
 */
export function PlanPage(props: PlanPageProps) {
  return (
    <ClientOnly>
      <PlanScreen {...props} />
    </ClientOnly>
  );
}
