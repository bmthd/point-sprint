import type { Plan } from "@workspaces/domain";
import { Box, Button, Drawer, Heading, IconButton, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { planResultAtom } from "../../state/derived";
import { BackIcon, CloseIcon, PencilIcon } from "../plan-home/icons";
import { PlanPage } from "../plan-home/plan-page";
import { RouterButton, RouterLink } from "../plan-list/router-link";
import { AccountPicker } from "./account-picker";
import { CampaignToggles } from "./campaign-toggles";
import { SettingsSaveFailureProvider, useSettingsSaveFailurePlanId } from "./settings-shared";
import { ShopAroundSettings, shopAroundOf } from "./shop-around-settings";
import { SpuTiles, spuRate } from "./spu-tiles";

/** 「保存して計算に反映」, in the drawer's footer and in the page's bottom bar. */
const primaryButton = { colorScheme: "primary", size: "lg", w: "full" } as const;

/** The settings themselves, on the settings page and in the desktop's side panel. */
export function SettingsContent({ plan }: { plan: Plan }) {
  return (
    <SettingsSaveFailureProvider key={plan.id}>
      <SettingsBody plan={plan} />
    </SettingsSaveFailureProvider>
  );
}

function SettingsBody({ plan }: { plan: Plan }) {
  const result = useAtomValue(planResultAtom(plan.id));
  const failed = useSettingsSaveFailurePlanId() === plan.id;
  if (!result) return null;
  return (
    <VStack gap="5" alignItems="stretch">
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          変更を保存できませんでした。もう一度お試しください。
        </Text>
      ) : null}
      <AccountPicker plan={plan} />
      <SpuTiles plan={plan} result={result} />
      <CampaignToggles plan={plan} />
      <ShopAroundSettings plan={plan} />
    </VStack>
  );
}

const num = (value: number) => Number(value.toFixed(2)).toLocaleString("ja-JP");

/** 「SPU +4.5倍・上限 7,000P」, the desktop header button's text. */
export function settingsSummary(plan: Plan) {
  const cap = shopAroundOf(plan)?.params.cap;
  return `SPU +${num(spuRate(plan))}倍${cap === undefined ? "" : `・上限 ${num(cap)}P`}`;
}

/** The desktop's header button and the side panel it opens with the same settings. */
export function SettingsPanelButton({
  plan,
  open,
  onOpen,
  onClose,
}: {
  plan: Plan;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const summary = settingsSummary(plan);
  return (
    <>
      <Button
        variant="outline"
        aria-label={`プランの設定（${summary}）`}
        onClick={onOpen}
        flex="none"
        fontVariantNumeric="tabular-nums"
        endIcon={<PencilIcon />}
      >
        {summary}
      </Button>
      <Drawer.Root
        open={open}
        onClose={onClose}
        placement="inline-end"
        size="lg"
        withCloseButton={false}
        restoreFocus
      >
        <Drawer.Content>
          <Drawer.Header justifyContent="space-between">
            <Drawer.Title as="h2">プランの設定</Drawer.Title>
            <IconButton variant="ghost" aria-label="閉じる" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Drawer.Header>
          <Drawer.Body alignItems="stretch">
            <SettingsContent plan={plan} />
          </Drawer.Body>
          <Drawer.Footer>
            <Button onClick={onClose} {...primaryButton}>
              保存して計算に反映
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

function SettingsScreen({ plan }: { plan: Plan }) {
  return (
    <>
      {/* 戻る goes back to this plan, which the site header has no link to. */}
      <Box maxW="640px" mx="auto" h="14" display="flex" alignItems="center" gap="1" px="2">
        <RouterLink
          to="/plan"
          search={{ id: plan.id }}
          aria-label="戻る"
          boxSize="11"
          display="flex"
          alignItems="center"
          justifyContent="center"
          rounded="xl"
          color="fg"
          _hover={{ bg: "bg.muted" }}
        >
          <BackIcon />
        </RouterLink>
        <Heading as="h1" fontSize="lg">
          プランの設定
        </Heading>
      </Box>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="32">
        <SettingsContent plan={plan} />
      </Box>
      <Box
        data-bottom-bar
        position="fixed"
        insetX="0"
        bottom="0"
        zIndex="docked"
        bg="bg.panel"
        borderTopWidth="1px"
        borderColor="border"
        px="4"
        pt="3"
        pb="calc(20px + env(safe-area-inset-bottom))"
      >
        <Box maxW="640px" mx="auto">
          <RouterButton to="/plan" search={{ id: plan.id }} {...primaryButton}>
            保存して計算に反映
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
      title={(plan) => `${plan.name}の設定`}
      render={(plan) => <SettingsScreen plan={plan} />}
    />
  );
}
