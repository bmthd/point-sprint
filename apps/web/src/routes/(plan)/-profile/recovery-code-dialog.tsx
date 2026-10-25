import {
  Button,
  Checkbox,
  Code,
  Field,
  Input,
  Modal,
  Text,
  VStack,
  useClipboard,
} from "@workspaces/ui";
import { useState } from "react";

/**
 * The recovery code, shown once right after sync starts. It closes only once the user says they
 * kept it: the server does not have it, and nobody can give it again.
 */
export function RecoveryCodeDialog({
  code,
  withoutPrf,
  onClose,
}: {
  code: string | undefined;
  /** The passkey made no key: the other devices need the code to open the data. */
  withoutPrf: boolean;
  onClose: () => void;
}) {
  const [kept, setKept] = useState(false);
  const { onCopy, copied } = useClipboard(code ?? "");
  return (
    <Modal.Root
      open={code !== undefined}
      closeOnOverlay={false}
      closeOnEsc={false}
      withCloseButton={false}
      title="復元用のコードを控えてください"
      body={
        <VStack gap="3" alignItems="stretch">
          <Text>
            パスキーで開けない端末や、パスキーをなくしたときに使います。運営者はこのコードを持っていないので、なくすと戻せません。パスワード管理アプリやメモに控えてください。
          </Text>
          <Code
            fontSize="lg"
            p="3"
            textAlign="center"
            letterSpacing="wider"
            fontVariantNumeric="tabular-nums"
            wordBreak="break-all"
          >
            {code}
          </Code>
          <Button variant="outline" alignSelf="center" onClick={() => onCopy()}>
            {copied ? "コピーしました" : "コピー"}
          </Button>
          {withoutPrf ? (
            <Text fontSize="sm" color="fg.muted">
              この端末のパスキーからは鍵を作れませんでした。ほかの端末でログインするときは、このコードも入れてください。
            </Text>
          ) : null}
          <Checkbox checked={kept} onChange={() => setKept((value) => !value)}>
            控えました
          </Checkbox>
        </VStack>
      }
      footerProps={{ justifyContent: "center" }}
      success={{ children: "閉じる", colorScheme: "primary", disabled: !kept }}
      onSuccess={onClose}
    />
  );
}

/**
 * Asks for the recovery code: to open the data on a device the passkey's key does not open, or to
 * get back in without a passkey. `onSubmit` resolves to `false` for a wrong code.
 */
export function RecoveryCodeEntry({
  open,
  title,
  description,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onSubmit: (code: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, setPending] = useState(false);
  const close = () => {
    setCode("");
    setWrong(false);
    onClose();
  };
  return (
    <Modal.Root
      open={open}
      title={title}
      body={
        <VStack gap="3" alignItems="stretch">
          <Text>{description}</Text>
          <Field.Root
            label="復元用のコード"
            invalid={wrong}
            errorMessage="コードが違います。控えたコードをもう一度確かめてください。"
          >
            <Input
              size="lg"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setWrong(false);
              }}
            />
          </Field.Root>
        </VStack>
      }
      cancel="キャンセル"
      success={{
        children: "開く",
        colorScheme: "primary",
        loading: pending,
        disabled: code.trim() === "",
      }}
      onClose={close}
      onCancel={close}
      onSuccess={() => {
        setPending(true);
        onSubmit(code)
          .then((opened) => {
            if (opened) close();
            else setWrong(true);
          })
          .catch(() => setWrong(true))
          .finally(() => setPending(false));
      }}
    />
  );
}
