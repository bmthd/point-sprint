import { useNavigate } from "@tanstack/react-router";
import type { Plan } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  Drawer,
  Heading,
  IconButton,
  Text,
  VStack,
  XIcon,
  ChevronLeftIcon,
  PencilIcon,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { hasPlanResultAtom, planAtom } from "#/state/derived.ts";
import { PlanPage } from "#/routes/(plan)/-plan-page.tsx";
import { useSpuLossNotice } from "#/routes/(plan)/-spu-loss-notice.tsx";
import { RouterButton, RouterIconButton } from "#/ui/router-link.tsx";
import { AccountPicker } from "./account-picker.tsx";
import { CampaignToggles } from "./campaign-toggles.tsx";
import { EventAttacher } from "./event-attacher.tsx";
import { PlanHoldSwitch } from "./plan-hold-switch.tsx";
import { SettingsSaveFailureProvider, useSettingsSaveFailurePlanId } from "./settings-shared.ts";
import { ShopAroundSettings } from "./shop-around-settings.tsx";
import { SpendTiersSettings } from "./spend-tiers-settings.tsx";
import { spuPageFromPlanAtom } from "#/routes/(plan)/-spu-month/spu-from.ts";
import { SpuSettingsCard } from "#/routes/(plan)/-spu-month/spu-month-rows.tsx";

/** 「計算に戻る」, in the drawer's footer and in the page's bottom bar. The settings are saved as they change. */
const primaryButton = { colorScheme: "primary", size: "lg", w: "full" } as const;

/**
 * The settings themselves, on the settings page and in the desktop's side panel. The SPU is not
 * the plan's but the month's: `onChangeSpu` opens the SPU of a month.
 */
export function SettingsContent({
  planId,
  onChangeSpu,
}: {
  planId: string;
  onChangeSpu: (month: string) => void;
}) {
  return (
    <SettingsSaveFailureProvider key={planId}>
      <SettingsBody planId={planId} onChangeSpu={onChangeSpu} />
    </SettingsSaveFailureProvider>
  );
}

function SettingsBody({
  planId,
  onChangeSpu,
}: {
  planId: string;
  onChangeSpu: (month: string) => void;
}) {
  const hasResult = useAtomValue(hasPlanResultAtom(planId));
  const failed = useSettingsSaveFailurePlanId() === planId;
  if (!hasResult) return null;
  return (
    <VStack gap="5" alignItems="stretch">
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          変更を保存できませんでした。もう一度お試しください。
        </Text>
      ) : null}
      <AccountPicker planId={planId} />
      <PlanHoldSwitch planId={planId} />
      <SpuSettingsCard
        planId={planId}
        title="SPU"
        note="月ごとに、すべてのプランで共有"
        onChange={onChangeSpu}
      />
      <CampaignToggles planId={planId} />
      <ShopAroundSettings planId={planId} />
      <SpendTiersSettings planId={planId} />
      {/* Last, since it appears once the events load and would push the settings below it down. */}
      <EventAttacher planId={planId} />
    </VStack>
  );
}

/**
 * The desktop's header button and the side panel it opens with the same settings. `onChangeSpu`
 * opens the SPU of a month, in place of the settings.
 */
export function SettingsPanelButton({
  planId,
  open,
  onOpen,
  onClose,
  onChangeSpu,
}: {
  planId: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeSpu: (month: string) => void;
}) {
  // Back from a month's SPU, the settings open where they were left.
  const scrollTop = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  return (
    <>
      <Button
        variant="ghost"
        colorScheme="gray"
        onClick={onOpen}
        flex="none"
        endIcon={<PencilIcon />}
      >
        プランの設定
      </Button>
      <Drawer.Root
        open={open}
        onClose={onClose}
        placement="inline-end"
        size="2xl"
        withCloseButton={false}
        restoreFocus
      >
        <Drawer.Content roundedLeft="l2">
          <Drawer.Header justifyContent="space-between">
            <Drawer.Title as="h2">プランの設定</Drawer.Title>
            <IconButton variant="ghost" aria-label="閉じる" onClick={onClose}>
              <XIcon />
            </IconButton>
          </Drawer.Header>
          <Drawer.Body
            alignItems="stretch"
            ref={(element: HTMLDivElement | null) => {
              body.current = element;
              if (!element || scrollTop.current === 0) return;
              element.scrollTop = scrollTop.current;
              scrollTop.current = 0;
            }}
          >
            <SettingsContent
              planId={planId}
              onChangeSpu={(month) => {
                scrollTop.current = body.current?.scrollTop ?? 0;
                onClose();
                onChangeSpu(month);
              }}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <Button onClick={onClose} {...primaryButton}>
              計算に戻る
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

function SettingsScreen({ planId }: { planId: string }) {
  const plan = useAtomValue(planAtom(planId));
  return plan ? <SettingsScreenContent plan={plan} /> : null;
}

function SettingsScreenContent({ plan }: { plan: Plan }) {
  useSpuLossNotice(plan.id);
  const navigate = useNavigate();
  const spuPage = useSetAtom(spuPageFromPlanAtom);
  return (
    <>
      {/* 戻る goes back to this plan, which the site header has no link to. */}
      <Flex maxW="640px" mx="auto" h="14" align="center" gap="1" px="2">
        <RouterIconButton
          to="/plan"
          search={{ id: plan.id }}
          aria-label="戻る"
          size="lg"
          variant="ghost"
          icon={<ChevronLeftIcon />}
        />
        <Heading as="h1" fontSize="lg">
          プランの設定
        </Heading>
      </Flex>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="32">
        <SettingsContent
          planId={plan.id}
          onChangeSpu={(month) => void navigate(spuPage(plan.id, month, true))}
        />
      </Box>
      <Box
        data-bottom-bar
        position="fixed"
        insetX="0"
        bottom="0"
        zIndex="kurillin"
        bg="bg.panel"
        borderTopWidth="1px"
        borderColor="border"
        px="4"
        pt="3"
        pb="calc(20px + env(safe-area-inset-bottom))"
      >
        <Box maxW="640px" mx="auto">
          <RouterButton to="/plan" search={{ id: plan.id }} {...primaryButton}>
            計算に戻る
          </RouterButton>
        </Box>
      </Box>
    </>
  );
}

/** The plan's settings at `/plan/settings?id=`. Each change is saved as it is made. */
export function PlanSettings({ id }: { id: string | undefined }) {
  return (
    <PlanPage
      id={id}
      title={(name) => `${name}の設定`}
      render={(planId) => <SettingsScreen planId={planId} />}
    />
  );
}
