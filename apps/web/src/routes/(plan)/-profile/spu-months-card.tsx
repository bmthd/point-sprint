import { useNavigate } from "@tanstack/react-router";
import { DEFAULT_ACCOUNT_ID, addMonths } from "@workspaces/domain";
import { Card, Field, Heading, NativeSelect, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId, useState } from "react";
import { accountSettingsAtom } from "../../../state/derived";
import { spuMonthsAtom } from "../../../state/queries";
import { ForwardIcon } from "../../../ui/icons";
import { RouterLink } from "../../../ui/router-link";
import { useToday } from "../../-use-today";
import { SpuMonthRows, unsetNote } from "../-spu-month/spu-month-rows";

const now = () => new Date();

/**
 * The SPU of this month and the next, each with 「変更」, and a link to the other months. Picks the
 * account first once the user tells accounts apart.
 */
export function SpuMonthsCard() {
  const navigate = useNavigate();
  const settings = useAtomValue(accountSettingsAtom);
  const stored = useAtomValue(spuMonthsAtom);
  const today = useToday(now);
  const [picked, setPicked] = useState(DEFAULT_ACCOUNT_ID);
  const titleId = useId();
  if (today === undefined) return null;
  const accountId =
    settings.enabled && settings.accounts.some((account) => account.id === picked)
      ? picked
      : DEFAULT_ACCOUNT_ID;
  const account = settings.enabled ? { account: accountId } : {};
  const thisMonth = today.slice(0, 7);
  const nextMonth = addMonths(thisMonth, 1);
  const note = (label: string, month: string) =>
    [label, unsetNote(stored, accountId, month)].filter(Boolean).join("・");
  return (
    <Card.Root as="section" aria-labelledby={titleId}>
      <Card.Body alignItems="stretch" gap="2">
        <Heading as="h2" id={titleId} fontSize="md">
          月ごとの SPU
        </Heading>
        <Text fontSize="xs" color="fg.muted">
          楽天のサービスを使うほど上がる、月ごとのポイント倍率です。注文の日付の月の SPU
          で、すべてのプランを計算します。
        </Text>
        {settings.enabled ? (
          <Field.Root label="楽天アカウント">
            <NativeSelect.Root
              value={accountId}
              onChange={(event) => setPicked(event.currentTarget.value)}
            >
              {settings.accounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </NativeSelect.Root>
          </Field.Root>
        ) : null}
        <div>
          <SpuMonthRows
            accountId={accountId}
            rows={[
              { month: thisMonth, note: note("今月", thisMonth) },
              { month: nextMonth, note: note("来月", nextMonth) },
            ]}
            onChange={(month) => void navigate({ to: "/spu", search: { month, ...account } })}
          />
        </div>
        <RouterLink
          to="/spu"
          search={{ month: addMonths(thisMonth, 2), ...account }}
          color="link"
          fontSize="sm"
          fontWeight="bold"
          alignSelf="flex-start"
          display="flex"
          alignItems="center"
          minH="11"
        >
          ほかの月
          <ForwardIcon />
        </RouterLink>
      </Card.Body>
    </Card.Root>
  );
}
