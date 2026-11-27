import {
  type Account,
  DEFAULT_ACCOUNT_ID,
  type Profile,
  accountsOf,
  newId,
} from "@workspaces/domain";
import {
  Box,
  Button,
  Card,
  Heading,
  IconButton,
  List,
  Modal,
  Switch,
  Text,
  useDisclosure,
  XIcon,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { CommitField } from "#/routes/(plan)/-form/commit-field.tsx";
import { AccountNameSchema } from "@workspaces/domain";
import {
  accountAtom,
  accountIdsAtom,
  isProfileReadyAtom,
  multiAccountEnabledAtom,
} from "#/state/derived.ts";
import { runSaveProfileAtom } from "#/state/mutations.ts";

/** The profile with its accounts changed; the default account is kept even when not stored yet. */
const withAccounts = (profile: Profile, change: (accounts: Account[]) => Account[]): Profile => ({
  ...profile,
  accounts: change(accountsOf(profile)),
});

function AccountRow({
  accountId,
  onFailed,
  onDelete,
}: {
  accountId: string;
  onFailed: (failed: boolean) => void;
  onDelete: (accountId: string) => void;
}) {
  const account = useAtomValue(accountAtom(accountId));
  const saveProfile = useSetAtom(runSaveProfileAtom);
  const rename = (name: string) => {
    onFailed(false);
    const saving = saveProfile({
      change: (current) =>
        withAccounts(current, (list) =>
          list.map((other) => (other.id === accountId ? { ...other, name } : other)),
        ),
    });
    saving.catch(() => onFailed(true));
    return saving;
  };
  if (!account) return null;
  return (
    <List.Item
      display="flex"
      alignItems="center"
      gap="1"
      py="2"
      borderTopWidth="1px"
      borderColor="border"
      _first={{ borderTopWidth: "0" }}
    >
      <Box flex="1" minW="0">
        <CommitField
          key={account.name}
          label={`${account.name}の名前`}
          hideLabel
          initial={account.name}
          schema={AccountNameSchema}
          onCommit={rename}
        />
      </Box>
      {accountId !== DEFAULT_ACCOUNT_ID ? (
        <IconButton
          variant="ghost"
          aria-label={`${account.name}を削除`}
          onClick={() => onDelete(accountId)}
        >
          <XIcon />
        </IconButton>
      ) : null}
    </List.Item>
  );
}

/**
 * Settings most users never need, kept out of the way: telling Rakuten accounts apart. Until it is
 * turned on, every plan is the default account's and no account shows anywhere else.
 */
export function AccountSettings({ onFailed }: { onFailed: (failed: boolean) => void }) {
  const enabled = useAtomValue(multiAccountEnabledAtom);
  const accountIds = useAtomValue(accountIdsAtom);
  const defaultAccount = useAtomValue(accountAtom(DEFAULT_ACCOUNT_ID));
  const isSuccess = useAtomValue(isProfileReadyAtom);
  const saveProfile = useSetAtom(runSaveProfileAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const [targetId, setTarget] = useState<string>();
  const target = useAtomValue(accountAtom(targetId ?? ""));
  const finalFocus = useRef<HTMLElement | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const defaultName = defaultAccount?.name;

  const save = (change: (profile: Profile) => Profile) => {
    onFailed(false);
    const saving = saveProfile({ change });
    saving.catch(() => onFailed(true));
    return saving;
  };
  const add = () => {
    // Made once, outside the change, so the cache and the repository get the same account.
    const id = newId();
    void save((current) =>
      withAccounts(current, (list) => [...list, { id, name: `アカウント${list.length + 1}` }]),
    );
  };

  return (
    <Card.Root as="section" aria-labelledby="advanced-settings-title">
      <Card.Body alignItems="stretch">
        <Heading as="h2" id="advanced-settings-title" fontSize="md">
          詳細設定
        </Heading>
        <Switch
          colorScheme="primary"
          reverse
          justifyContent="space-between"
          disabled={!isSuccess}
          checked={enabled}
          onChange={(event) => {
            const on = event.currentTarget.checked;
            void save((current) => ({ ...current, multiAccount: on }));
          }}
        >
          複数の楽天アカウントを使い分ける
        </Switch>
        <Text fontSize="xs" color="fg.muted">
          家族のアカウントなどでも買うときに。キャンペーンの上限をアカウントごとに分けて計算し、SPU
          もアカウントごとに設定します。
        </Text>
        {enabled ? (
          <>
            <List.Root aria-label="楽天アカウント" gap="0">
              {accountIds.map((accountId) => (
                <AccountRow
                  key={accountId}
                  accountId={accountId}
                  onFailed={onFailed}
                  onDelete={(id) => {
                    setTarget(id);
                    finalFocus.current = null;
                    onOpen();
                  }}
                />
              ))}
            </List.Root>
            <Button
              ref={addRef}
              variant="outline"
              colorScheme="primary"
              alignSelf="start"
              onClick={add}
            >
              ＋ アカウントを追加
            </Button>
          </>
        ) : null}
        <Modal.Root
          open={open}
          title="アカウントを削除しますか？"
          body={
            <Text>
              「{target?.name}」で買うプランは、「{defaultName}」のプランとして計算します。
            </Text>
          }
          cancel="キャンセル"
          success={{ children: "削除する", colorScheme: "danger" }}
          finalFocusRef={finalFocus}
          onClose={onClose}
          onCancel={onClose}
          onSuccess={() => {
            const id = target?.id;
            if (id) {
              void save((current) =>
                withAccounts(current, (list) => list.filter((other) => other.id !== id)),
              );
            }
            onClose();
            // The delete button is gone, so the dialog cannot hand focus back to it.
            finalFocus.current = addRef.current;
          }}
        />
      </Card.Body>
    </Card.Root>
  );
}
