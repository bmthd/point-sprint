import { selectAtom } from "jotai/utils";
import { type CalculationResult } from "@workspaces/domain";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
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
import { useEffect, useRef } from "react";
import { settingsPanel } from "#/routes/(plan)/-plan-search.ts";
import { planResultAtom } from "#/state/derived.ts";
import { PlanPage } from "#/routes/(plan)/-plan-page.tsx";
import { useSpuLossNotice } from "#/routes/(plan)/-spu-loss-notice.tsx";
import { RouterButton, RouterIconButton } from "#/ui/router-link.tsx";
import { AccountPicker } from "./account-picker.tsx";
import { CampaignToggles } from "./campaign-toggles.tsx";
import { EventAttacher } from "./event-attacher.tsx";
import { PlanManagement } from "./plan-management.tsx";
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
  const hasResult = useAtomValue(selectAtom(planResultAtom(planId), resultExists));
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
      <SpuSettingsCard
        planId={planId}
        title="SPU"
        note="月ごとに、すべてのプランで共有"
        onChange={onChangeSpu}
      />
      <CampaignToggles planId={planId} />
      <ShopAroundSettings planId={planId} />
      <SpendTiersSettings planId={planId} />
      {/* Near the end, since it appears once the events load and would push the settings below it down. */}
      <EventAttacher planId={planId} />
      <PlanManagement planId={planId} />
    </VStack>
  );
}

/**
 * The settings' side panel on a desktop is open while the URL has `settings`, under the address of
 * their own page, so the back button closes it. A month's SPU opened from them keeps `settings`
 * and covers them until it is closed. Closing them goes back when this page opened them, and
 * otherwise drops `settings` in place.
 */
export function useSettingsPanelTarget(planId: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const search: { settings?: unknown; spu?: unknown } = useSearch({ strict: false });
  const openedHere = useRef(false);
  const shown = search.settings === true;
  const open = () => {
    openedHere.current = true;
    void navigate(settingsPanel(planId));
  };
  const close = () => {
    if (openedHere.current) {
      openedHere.current = false;
      router.history.back();
    } else {
      void navigate({ to: "/plan", search: { id: planId }, replace: true });
    }
  };
  useEffect(() => {
    // Closed by the browser's back button: the next close must not go back again.
    if (!shown) openedHere.current = false;
  }, [shown]);
  return { shown, open: shown && search.spu === undefined, onOpen: open, onClose: close };
}

/**
 * The desktop's header button and the side panel it opens with the same settings. `onChangeSpu`
 * opens the SPU of a month over the settings, which are back where they were left once it closes.
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
  useSpuLossNotice(planId);
  const navigate = useNavigate();
  const spuPage = useSetAtom(spuPageFromPlanAtom);
  return (
    <>
      {/* 戻る goes back to this plan, which the site header has no link to. */}
      <Flex maxW="640px" mx="auto" h="14" align="center" gap="1" px="2">
        <RouterIconButton
          to="/plan"
          search={{ id: planId }}
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
          planId={planId}
          onChangeSpu={(month) => void navigate(spuPage(planId, month, true))}
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
          <RouterButton to="/plan" search={{ id: planId }} {...primaryButton}>
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

const resultExists = (result: CalculationResult | undefined) => result !== undefined;
