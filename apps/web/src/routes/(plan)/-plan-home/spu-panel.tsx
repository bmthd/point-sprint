import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { MonthSchema, type Plan, spuMonthsOfPlan } from "@workspaces/domain";
import { Box, Button, Drawer, IconButton, SegmentedControl, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import * as v from "valibot";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { CloseIcon } from "../../../ui/icons";
import { useToday } from "../../-use-today";
import { SpuMonthEditor, spuMonthText } from "../-spu-month/spu-month-editor";

/**
 * The month whose SPU is open in the side panel, while the URL has `spu=` (`YYYY-MM`), so the back
 * button closes it. Closing it goes back when this page opened it, and otherwise drops `spu=` in
 * place.
 */
export function useSpuPanelTarget(planId: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const search: { spu?: unknown } = useSearch({ strict: false });
  const openedHere = useRef(false);
  const open = useCallback(
    (month: string) => {
      openedHere.current = true;
      void navigate({ to: "/plan", search: { id: planId, spu: month } });
    },
    [navigate, planId],
  );
  /** Another month of the plan in the open panel, in place of the one shown. */
  const show = useCallback(
    (month: string) =>
      void navigate({ to: "/plan", search: { id: planId, spu: month }, replace: true }),
    [navigate, planId],
  );
  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.history.back();
    } else {
      void navigate({ to: "/plan", search: { id: planId }, replace: true });
    }
  }, [navigate, router, planId]);
  const target = v.is(MonthSchema, search.spu) ? search.spu : undefined;
  useEffect(() => {
    // Closed by the browser's back button: the next close must not go back again.
    if (target === undefined) openedHere.current = false;
  }, [target]);
  return { target, open, show, close };
}

const now = () => new Date();

/** The SPU of `month` in a side panel over the plan, on a desktop. Nothing while `month` is not set. */
export function SpuPanel({
  plan,
  month,
  onMonth,
  onClose,
}: {
  plan: Plan;
  month: string | undefined;
  onMonth: (month: string) => void;
  onClose: () => void;
}) {
  const settings = useAtomValue(accountSettingsAtom);
  const today = useToday(now);
  const months = spuMonthsOfPlan(plan);
  // While the panel slides out, it keeps showing the month it was closed on.
  const [last, setLast] = useState(month);
  if (month !== undefined && month !== last) setLast(month);
  const shown = month ?? last;
  return (
    <Drawer.Root
      open={month !== undefined}
      onClose={onClose}
      placement="inline-end"
      size="2xl"
      withCloseButton={false}
      restoreFocus
    >
      <Drawer.Content roundedLeft="l2">
        <Drawer.Header justifyContent="space-between">
          <Drawer.Title as="h2">
            {shown ? `${spuMonthText(shown, today)}の SPU` : null}
          </Drawer.Title>
          <IconButton variant="ghost" aria-label="閉じる" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Drawer.Header>
        <Drawer.Body alignItems="stretch">
          {shown && months.length > 1 ? (
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                {plan.name}の注文がある月
              </Text>
              <SegmentedControl.Root
                aria-label="SPU の月"
                items={months.map((value) => ({ label: spuMonthText(value, today), value }))}
                value={shown}
                onChange={onMonth}
              />
            </Box>
          ) : null}
          {shown ? (
            <SpuMonthEditor
              accountId={accountIdOf(plan, settings)}
              month={shown}
              planId={plan.id}
            />
          ) : null}
        </Drawer.Body>
        <Drawer.Footer>
          <Button colorScheme="primary" size="lg" w="full" onClick={onClose}>
            計算に反映して閉じる
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer.Root>
  );
}
