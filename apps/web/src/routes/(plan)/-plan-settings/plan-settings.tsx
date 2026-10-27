import { useNavigate } from "@tanstack/react-router";
import type { Plan } from "@workspaces/domain";
import { Box, Flex, Button, Drawer, Heading, IconButton, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../../state/derived";
import { BackIcon, CloseIcon, PencilIcon } from "../../../ui/icons";
import { PlanPage } from "../-plan-page";
import { RouterButton, RouterIconButton } from "../../../ui/router-link";
import { AccountPicker } from "./account-picker";
import { CampaignToggles } from "./campaign-toggles";
import { SettingsSaveFailureProvider, useSettingsSaveFailurePlanId } from "./settings-shared";
import { ShopAroundSettings } from "./shop-around-settings";
import { SpendTiersSettings } from "./spend-tiers-settings";
import { spuPageFromPlan } from "../-spu-month/spu-from";
import { SpuSettingsCard } from "../-spu-month/spu-month-rows";

/** 「保存して計算に反映」, in the drawer's footer and in the page's bottom bar. */
const primaryButton = { colorScheme: "primary", size: "lg", w: "full" } as const;

/**
 * The settings themselves, on the settings page and in the desktop's side panel. The SPU is not
 * the plan's but the month's: `onChangeSpu` opens the SPU of a month.
 */
export function SettingsContent({
  plan,
  onChangeSpu,
}: {
  plan: Plan;
  onChangeSpu: (month: string) => void;
}) {
  return (
    <SettingsSaveFailureProvider key={plan.id}>
      <SettingsBody plan={plan} onChangeSpu={onChangeSpu} />
    </SettingsSaveFailureProvider>
  );
}

function SettingsBody({ plan, onChangeSpu }: { plan: Plan; onChangeSpu: (month: string) => void }) {
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
      <SpuSettingsCard
        plan={plan}
        title="SPU"
        note="月ごとに、すべてのプランで共有"
        onChange={onChangeSpu}
      />
      <CampaignToggles plan={plan} />
      <ShopAroundSettings plan={plan} />
      <SpendTiersSettings plan={plan} />
    </VStack>
  );
}

/**
 * The desktop's header button and the side panel it opens with the same settings. `onChangeSpu`
 * opens the SPU of a month, in place of the settings.
 */
export function SettingsPanelButton({
  plan,
  open,
  onOpen,
  onClose,
  onChangeSpu,
}: {
  plan: Plan;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeSpu: (month: string) => void;
}) {
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
              <CloseIcon />
            </IconButton>
          </Drawer.Header>
          <Drawer.Body alignItems="stretch">
            <SettingsContent
              plan={plan}
              onChangeSpu={(month) => {
                onClose();
                onChangeSpu(month);
              }}
            />
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
  const navigate = useNavigate();
  const settings = useAtomValue(accountSettingsAtom);
  const account = settings.enabled ? accountIdOf(plan, settings) : undefined;
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
          icon={<BackIcon />}
        />
        <Heading as="h1" fontSize="lg">
          プランの設定
        </Heading>
      </Flex>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="32">
        <SettingsContent
          plan={plan}
          onChangeSpu={(month) => void navigate(spuPageFromPlan(plan.id, month, account))}
        />
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
