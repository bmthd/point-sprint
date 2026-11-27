import type { Plan } from "@workspaces/domain";
import { Alert, Button } from "@workspaces/ui";

/**
 * On a held plan whose event has ended (its period, which is the event's unless changed by hand):the plan can be carried over to another event, with its
 * orders. Shown even before the next event is published, so that the user learns it can be done.
 */
export function CarryOverNotice({
  plan,
  today,
  onCarryOver,
}: {
  plan: Plan;
  today: string | undefined;
  onCarryOver: () => void;
}) {
  const ended =
    plan.officialEventId !== undefined && today !== undefined && plan.period.end < today;
  if (!plan.onHold || !ended) return null;
  return (
    <Alert.Root status="info" role="status" alignItems="center" flexWrap="wrap" gap="3">
      <Alert.Icon />
      <Alert.Description flex="1 1 16em">
        このイベントは終わりました。注文を残したまま、別のイベントに引き継げます。
      </Alert.Description>
      <Button
        variant="outline"
        bg="bg.panel"
        w={{ base: "auto", md: "full" }}
        onClick={onCarryOver}
      >
        別のイベントに引き継ぐ
      </Button>
    </Alert.Root>
  );
}
