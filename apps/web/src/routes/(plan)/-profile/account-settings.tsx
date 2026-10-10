import { type Account, DEFAULT_ACCOUNT_ID, type Profile, accountsOf } from "@workspaces/domain";
import {
  Box,
  Flex,
  Button,
  Card,
  IconButton,
  Modal,
  Switch,
  Text,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import { CommitField } from "../../../form/commit-field";
import { AccountNameSchema } from "../../../form/field-schemas";
import { accountSettingsAtom } from "../../../state/derived";
import { saveProfileAtom } from "../../../state/mutations";
import { profileQueryAtom } from "../../../state/queries";
import { CloseIcon } from "../../../ui/icons";

/** The profile with its accounts changed; the default account is kept even when not stored yet. */
const withAccounts = (profile: Profile, change: (accounts: Account[]) => Account[]): Profile => ({
  ...profile,
  accounts: change(accountsOf(profile)),
});

function AccountRow({
  account,
  onRename,
  onDelete,
}: {
  account: Account;
  onRename: (name: string) => Promise<unknown>;
  onDelete?: () => void;
}) {
  return (
    <Flex
      as="li"
      align="center"
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
          onCommit={onRename}
        />
      </Box>
      {onDelete ? (
        <IconButton variant="ghost" aria-label={`${account.name}を削除`} onClick={onDelete}>
          <CloseIcon />
        </IconButton>
      ) : null}
    </Flex>
  );
}

/**
 * Settings most users never need, kept out of the way: telling Rakuten accounts apart. Until it is
 * turned on, every plan is the default account's and no account shows anywhere else.
 */
export function AccountSettings({ onFailed }: { onFailed: (failed: boolean) => void }) {
  const { enabled, accounts } = useAtomValue(accountSettingsAtom);
  const { isSuccess } = useAtomValue(profileQueryAtom);
  const { mutateAsync: saveProfile } = useAtomValue(saveProfileAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const [target, setTarget] = useState<Account>();
  const finalFocus = useRef<HTMLElement | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const defaultName = accounts.find((account) => account.id === DEFAULT_ACCOUNT_ID)?.name;

  const save = (change: (profile: Profile) => Profile) => {
    onFailed(false);
    const saving = saveProfile({ change });
    saving.catch(() => onFailed(true));
    return saving;
  };
  const add = () => {
    // Made once, outside the change, so the cache and the repository get the same account.
    const id = crypto.randomUUID();
    void save((current) =>
      withAccounts(current, (list) => [...list, { id, name: `アカウント${list.length + 1}` }]),
    );
  };

  return (
    <Card.Root as="section" aria-labelledby="advanced-settings-title">
      <Card.Body alignItems="stretch">
        <Text as="h2" id="advanced-settings-title" fontSize="md" fontWeight="bold">
          詳細設定
        </Text>
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
          家族のアカウントなどでも買うときに。キャンペーンの上限をアカウントごとに分けて計算します。
        </Text>
        {enabled ? (
          <>
            <Box as="ul" aria-label="楽天アカウント" listStyleType="none" m="0" p="0">
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onRename={(name) =>
                    save((current) =>
                      withAccounts(current, (list) =>
                        list.map((other) => (other.id === account.id ? { ...other, name } : other)),
                      ),
                    )
                  }
                  onDelete={
                    account.id === DEFAULT_ACCOUNT_ID
                      ? undefined
                      : () => {
                          setTarget(account);
                          finalFocus.current = null;
                          onOpen();
                        }
                  }
                />
              ))}
            </Box>
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
