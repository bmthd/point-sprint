import {
  ClientOnly,
  useCanGoBack,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { DEFAULT_ACCOUNT_ID, addMonths, spuMonthsOfPlan } from "@workspaces/domain";
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  NativeSelect,
  SegmentedControl,
  Text,
  VStack,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { accountIdOf } from "../../state/accounts";
import { accountSettingsAtom, planAtom } from "../../state/derived";
import { BackIcon, ForwardIcon } from "../../ui/icons";
import { RouterButton, RouterIconButton } from "../../ui/router-link";
import { useToday } from "../-use-today";
import { SpuMonthEditor, spuMonthText } from "./-spu-month/spu-month-editor";

const now = () => new Date();

/** 「戻る」 to 共通設定: back where the page was opened from, or to 共通設定 when it was opened directly. */
function BackToCommon() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <RouterIconButton
      to="/settings"
      aria-label="共通設定に戻る"
      onClick={(event) => {
        if (!canGoBack) return;
        event.preventDefault();
        router.history.back();
      }}
      size="lg"
      variant="ghost"
      icon={<BackIcon />}
    />
  );
}

function SpuScreen({ month, account }: { month: string; account: string | undefined }) {
  const navigate = useNavigate();
  const settings = useAtomValue(accountSettingsAtom);
  const today = useToday(now);
  const from = useLocation({ select: (location) => location.state.spuFrom });
  const plan = useAtomValue(planAtom(from?.planId ?? ""));
  const accountId =
    settings.enabled && settings.accounts.some((candidate) => candidate.id === account)
      ? (account ?? DEFAULT_ACCOUNT_ID)
      : plan
        ? accountIdOf(plan, settings)
        : DEFAULT_ACCOUNT_ID;
  /** Shows another month or account in place, the page still opened from where it was. */
  const show = (next: { month: string; account?: string }) =>
    void navigate({
      to: "/spu",
      search: {
        month: next.month,
        ...(settings.enabled ? { account: next.account ?? accountId } : {}),
      },
      state: (state) => state,
      replace: true,
    });
  const planMonths = plan ? spuMonthsOfPlan(plan) : [];
  const title = `${spuMonthText(month, today)}の SPU`;
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);

  return (
    <>
      <Flex maxW="640px" mx="auto" h="14" align="center" gap="1" px="2">
        {plan ? (
          <RouterIconButton
            to="/plan"
            search={{ id: plan.id }}
            aria-label={`${plan.name}に戻る`}
            size="lg"
            variant="ghost"
            icon={<BackIcon />}
          />
        ) : (
          <BackToCommon />
        )}
        <Heading as="h1" fontSize="lg" flex="1" minW="0">
          {title}
        </Heading>
        {plan ? null : (
          <Flex gap="1" flex="none">
            <Button
              variant="outline"
              bg="bg.panel"
              size="sm"
              px="2"
              aria-label={`${spuMonthText(previous, today)}の SPU`}
              onClick={() => show({ month: previous })}
              startIcon={<BackIcon />}
            >
              {spuMonthText(previous, today)}
            </Button>
            <Button
              variant="outline"
              bg="bg.panel"
              size="sm"
              px="2"
              aria-label={`${spuMonthText(next, today)}の SPU`}
              onClick={() => show({ month: next })}
              endIcon={<ForwardIcon />}
            >
              {spuMonthText(next, today)}
            </Button>
          </Flex>
        )}
      </Flex>
      <VStack as="main" maxW="640px" mx="auto" px="4" pt="1" pb="32" gap="3" alignItems="stretch">
        {plan && planMonths.length > 1 ? (
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              {plan.name}の注文がある月
            </Text>
            <SegmentedControl.Root
              aria-label="SPU の月"
              w="full"
              items={planMonths.map((value) => ({ label: spuMonthText(value, today), value }))}
              value={month}
              onChange={(value) => show({ month: value })}
            />
          </Box>
        ) : null}
        {settings.enabled ? (
          <Field.Root label="楽天アカウント">
            <NativeSelect.Root
              value={accountId}
              onChange={(event) => show({ month, account: event.currentTarget.value })}
            >
              {settings.accounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </NativeSelect.Root>
          </Field.Root>
        ) : null}
        <SpuMonthEditor accountId={accountId} month={month} planId={plan?.id} />
      </VStack>
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
          {plan ? (
            <RouterButton
              to="/plan"
              search={{ id: plan.id }}
              colorScheme="primary"
              size="lg"
              w="full"
            >
              {plan.name}に戻る
            </RouterButton>
          ) : (
            <RouterButton to="/settings" colorScheme="primary" size="lg" w="full">
              共通設定に戻る
            </RouterButton>
          )}
        </Box>
      </Box>
    </>
  );
}

/**
 * The SPU of one month at `/spu?month=`. Opened from a plan (the history state's `spuFrom`), it
 * goes back to the plan and switches among the plan's months; otherwise it goes back to 共通設定
 * and steps a month at a time. The SPU lives on this device, so it renders on the client only.
 */
export function SpuPage({
  month,
  account,
}: {
  month: string | undefined;
  account: string | undefined;
}) {
  const today = useToday(now);
  const shown = month ?? today?.slice(0, 7);
  return <ClientOnly>{shown ? <SpuScreen month={shown} account={account} /> : null}</ClientOnly>;
}
