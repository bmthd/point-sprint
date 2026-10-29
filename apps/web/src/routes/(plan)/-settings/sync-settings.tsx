import { queryKeys } from "../../../state/queries";
import {
  Alert,
  Button,
  Card,
  Heading,
  Link,
  Modal,
  Status,
  Text,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { type ComponentType, useState } from "react";
import { repositoryAtom } from "../../../state/repository";
import {
  type SyncStatus,
  requestSyncAtom,
  syncEnabledQueryAtom,
  syncStatusAtom,
} from "../../../state/sync";
import {
  type Locked,
  type Passkeys,
  SyncError,
  browserPasskeys,
  recoverWithCode,
  reissueRecoveryCode,
  signIn,
  startSync,
  stopSync,
  unlockWithRecoveryCode,
} from "../../../storage/sync-passkey";
import { syncServerAtom } from "../../-sync-server";
import { TurnstileWidget, type TurnstileWidgetProps } from "../../-turnstile-widget";
import { RecoveryCodeDialog, RecoveryCodeEntry } from "./recovery-code-dialog";

/** A step the user took, for Google Analytics: how many start and how many get through. */
function track(event: string) {
  window.gtag?.("event", event);
}

const errorMessages: Record<string, string> = {
  "master-unavailable":
    "この端末には再発行に必要な鍵が残っていません。ほかの端末で再発行するか、復元用のコードで一度開き直してください。",
  turnstile: "確認できませんでした。もう一度お試しください。",
  cancelled: "パスキーの操作が取り消されました。",
  refused: "パスキーでログインできませんでした。この端末にパスキーがあるか確かめてください。",
  "signed-out": "ログインが切れました。パスキーでログインし直してください。",
};
const messageOf = (error: unknown) =>
  (error instanceof SyncError && errorMessages[error.reason]) ||
  "うまくいきませんでした。通信を確かめて、もう一度お試しください。";

const time = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

function statusText(status: SyncStatus): {
  text: string;
  value: "info" | "success" | "warning" | "error";
} {
  switch (status.state) {
    case "syncing":
      return { text: "同期しています", value: "info" };
    case "synced":
      return { text: `同期しました（${time(status.lastSyncedAt)}）`, value: "success" };
    case "offline":
      return { text: "つながっていません。つながったら送ります", value: "warning" };
    case "signed-out":
      return { text: "ログインが切れました", value: "warning" };
    case "failed":
      return { text: "同期できませんでした。しばらくしてからもう一度試します", value: "error" };
    case "off":
      return { text: "同期を待っています", value: "info" };
  }
}

type Props = {
  siteKey: string | undefined;
  /** Tests only: stand-ins for the browser's passkeys and the Turnstile widget. */
  passkeys?: Passkeys;
  widget?: ComponentType<TurnstileWidgetProps>;
};

/**
 * 「ほかの端末と同期」: starting to sync with a new passkey, logging in on another device, and
 * stopping. The data is sealed on the device; the recovery code is shown once.
 */
export function SyncSettings({
  siteKey,
  passkeys = browserPasskeys,
  widget: Widget = TurnstileWidget,
}: Props) {
  const server = useAtomValue(syncServerAtom);
  const repository = useAtomValue(repositoryAtom);
  const client = useAtomValue(queryClientAtom);
  const { data: enabled } = useAtomValue(syncEnabledQueryAtom);
  const status = useAtomValue(syncStatusAtom);
  const { request } = useAtomValue(requestSyncAtom);
  const deps = { passkeys, server, repository };

  const [error, setError] = useState<string>();
  /** What happened that is not a failure. */
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [token, setToken] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const [started, setStarted] = useState<{ code: string; withoutPrf: boolean }>();
  const [locked, setLocked] = useState<Locked>();
  const [recovering, setRecovering] = useState(false);
  const stopping = useDisclosure();
  const reissuing = useDisclosure();

  const synced = async () => {
    await client.invalidateQueries({ queryKey: queryKeys.syncEnabled });
    void request();
  };
  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    setNotice(undefined);
    setPending(true);
    try {
      await action();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  };

  const start = () =>
    run(async () => {
      if (!token) return;
      try {
        const result = await startSync(deps, token);
        track("sync_start_done");
        setStarting(false);
        setStarted({ code: result.recoveryCode, withoutPrf: !result.prf });
      } finally {
        // A token is good for one request only.
        setToken(undefined);
        setResetKey((key) => key + 1);
      }
    });
  const logIn = () =>
    run(async () => {
      track("sync_login_click");
      const result = await signIn(deps);
      if (result.status === "unlocked") {
        track("sync_login_done");
        await synced();
      } else {
        track("sync_recovery_code_needed");
        setLocked(result.locked);
      }
    });

  const body = enabled ? (
    <>
      <Status role="status" value={statusText(status).value}>
        {statusText(status).text}
      </Status>
      {status.state === "signed-out" ? (
        <Button colorScheme="primary" alignSelf="start" loading={pending} onClick={logIn}>
          パスキーでログイン
        </Button>
      ) : null}
      <Button
        variant="outline"
        alignSelf="start"
        disabled={pending || locked !== undefined || status.state === "signed-out"}
        onClick={reissuing.onOpen}
      >
        復元用のコードを再発行
      </Button>
      <Text fontSize="xs" color="fg.muted">
        同期をやめると、サーバーにあるデータを消します。この端末のデータは残ります。
      </Text>
      <Button variant="outline" colorScheme="danger" alignSelf="start" onClick={stopping.onOpen}>
        同期をやめる
      </Button>
    </>
  ) : (
    <>
      <Text fontSize="sm">
        パスキーでログインすると、PC
        とスマホで同じプランと注文を使えます。データは端末の中で暗号にしてから送るので、運営者も読めません。
      </Text>
      {starting ? (
        siteKey === undefined ? (
          <Text fontSize="sm" color="danger.fg">
            いまは同期を始められません。
          </Text>
        ) : (
          <VStack gap="2" alignItems="stretch">
            <Widget siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
            <Button
              colorScheme="primary"
              alignSelf="start"
              disabled={!token}
              loading={pending}
              onClick={start}
            >
              パスキーを作って始める
            </Button>
          </VStack>
        )
      ) : (
        <Button
          colorScheme="primary"
          alignSelf="start"
          onClick={() => {
            track("sync_start_click");
            setError(undefined);
            setStarting(true);
          }}
        >
          パスキーで同期を始める
        </Button>
      )}
      <Button variant="outline" alignSelf="start" loading={pending && !starting} onClick={logIn}>
        ほかの端末で始めた同期にログイン
      </Button>
      <Text fontSize="sm" color="fg.muted">
        パスキーをなくしたときは、
        <Link
          as="button"
          color="link"
          onClick={() => {
            setError(undefined);
            setRecovering(true);
          }}
        >
          復元用のコードで戻す
        </Link>
      </Text>
    </>
  );

  return (
    <Card.Root as="section" aria-labelledby="sync-settings-title">
      <Card.Body alignItems="stretch">
        <Heading as="h2" id="sync-settings-title" fontSize="md">
          ほかの端末と同期
        </Heading>
        {body}
        {notice ? (
          <Alert.Root status="info" role="status">
            <Alert.Icon />
            <Alert.Description>{notice}</Alert.Description>
          </Alert.Root>
        ) : null}
        {error ? (
          <Alert.Root status="error" role="alert">
            <Alert.Icon />
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        ) : null}
        <RecoveryCodeDialog
          key={started?.code ?? "closed"}
          code={started?.code}
          withoutPrf={started?.withoutPrf ?? false}
          onClose={() => {
            setStarted(undefined);
            void synced();
          }}
        />
        <RecoveryCodeEntry
          open={locked !== undefined}
          title="復元用のコードを入れてください"
          description="ログインできました。この端末のパスキーからはデータの鍵を開けなかったので、同期を始めたときに控えた復元用のコードを入れてください。次からは聞きません。"
          onClose={() => setLocked(undefined)}
          onSubmit={async (code) => {
            if (!locked) return false;
            const opened = await unlockWithRecoveryCode(deps, locked, code);
            if (opened) {
              track("sync_login_done");
              await synced();
            }
            return opened;
          }}
        />
        <RecoveryCodeEntry
          open={recovering}
          title="復元用のコードで戻す"
          description="同期を始めたときに控えた復元用のコードを入れてください。開けたら、この端末で新しいパスキーを作ります。"
          onClose={() => setRecovering(false)}
          onSubmit={async (code) => {
            const recovered = await recoverWithCode(deps, code);
            if (!recovered) return false;
            await synced();
            if (!recovered.passkey) {
              setError(
                "データは開けましたが、パスキーを作れませんでした。同期をやめずに、あとでもう一度お試しください。",
              );
            }
            return true;
          }}
        />
        <Modal.Root
          open={reissuing.open}
          title="復元用のコードを再発行しますか？"
          body={
            <Text>
              再発行すると、以前のコードは使えなくなります。新しいコードを必ず控えてください。既存のパスキーと、ほかの端末の同期は引き続き使えます。
            </Text>
          }
          cancel={{ children: "キャンセル", disabled: pending }}
          success={{ children: "再発行する", loading: pending }}
          closeOnEsc={!pending}
          closeOnOverlay={!pending}
          withCloseButton={!pending}
          onClose={reissuing.onClose}
          onCancel={reissuing.onClose}
          onSuccess={() =>
            void run(async () => {
              try {
                const code = await reissueRecoveryCode(deps);
                setStarted({ code, withoutPrf: false });
              } finally {
                reissuing.onClose();
              }
            })
          }
        />
        <Modal.Root
          open={stopping.open}
          title="同期をやめますか？"
          body={
            <Text>
              サーバーにあるデータを消して、同期をやめます。この端末のデータは残ります。ほかの端末のデータも残りますが、もう同期されません。
            </Text>
          }
          cancel="キャンセル"
          success={{ children: "同期をやめる", colorScheme: "danger", loading: pending }}
          onClose={stopping.onClose}
          onCancel={stopping.onClose}
          onSuccess={() =>
            void run(async () => {
              try {
                const { removed } = await stopSync(deps);
                await client.invalidateQueries({ queryKey: queryKeys.syncEnabled });
                if (!removed) {
                  setNotice(
                    "この端末の同期をやめました。ログインが切れていたため、サーバーのデータは消していません。ほかの端末ですでに同期をやめていれば、消えています。",
                  );
                }
              } finally {
                stopping.onClose();
              }
            })
          }
        />
      </Card.Body>
    </Card.Root>
  );
}
