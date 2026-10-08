import { DEFAULT_ACCOUNT_ID, type Plan } from "@workspaces/domain";
import { Card, Field, NativeSelect, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { savePlanAtom } from "../../../state/mutations";
import { useSaveSettingsChange } from "./settings-shared";

/** The plan with `accountId` as its account; the default account is left out, as on a new plan. */
const withAccount = (plan: Plan, accountId: string): Plan => {
  const { accountId: _, ...rest } = plan;
  return accountId === DEFAULT_ACCOUNT_ID ? rest : { ...rest, accountId };
};

/** The account the plan is bought with. Shown only once the user tells accounts apart. */
export function AccountPicker({ plan }: { plan: Plan }) {
  const settings = useAtomValue(accountSettingsAtom);
  const { mutateAsync: savePlan } = useAtomValue(savePlanAtom);
  const save = useSaveSettingsChange(plan.id);
  if (!settings.enabled) return null;
  return (
    <Card.Root as="section" aria-label="アカウント">
      <Card.Body alignItems="stretch">
        <Field.Root label="購入するアカウント">
          <NativeSelect.Root
            value={accountIdOf(plan, settings)}
            onChange={(event) => {
              const accountId = event.currentTarget.value;
              save(
                savePlan({
                  planId: plan.id,
                  change: (current) => {
                    if (!current) throw new Error(`plan ${plan.id} does not exist`);
                    return withAccount(current, accountId);
                  },
                }),
              );
            }}
          >
            {settings.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </NativeSelect.Root>
        </Field.Root>
        <Text fontSize="xs" color="fg.muted">
          キャンペーンの上限は、同じアカウントのプランの間で分け合います。
        </Text>
      </Card.Body>
    </Card.Root>
  );
}
