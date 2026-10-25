import type { StoreName } from "@workspaces/domain";
import {
  Alert,
  Button,
  Card,
  Code,
  Heading,
  List,
  Modal,
  Text,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { deleteQuarantinedAtom } from "../../state/mutations";
import { quarantineQueryAtom, storageHealthQueryAtom } from "../../state/queries";

const storeLabels: Record<StoreName, string> = {
  plans: "プラン",
  orders: "注文",
  shops: "ショップ台帳",
  profile: "プロフィール",
  spuMonths: "月の SPU",
};

function QuarantinedRows() {
  const { data: rows, isError } = useAtomValue(quarantineQueryAtom);
  const { mutate: remove, isPending } = useAtomValue(deleteQuarantinedAtom);
  if (isError) return <Text color="danger.fg">データを読み込めませんでした。</Text>;
  return (
    <VStack gap="md" alignItems="stretch">
      {rows?.map((row) => (
        <Card.Root
          key={row.key}
          as="section"
          variant="outline"
          aria-label={`${storeLabels[row.store]}のデータ`}
        >
          <Card.Header justifyContent="space-between">
            <Heading as="h3" size="sm">
              {storeLabels[row.store]}
            </Heading>
            <Button
              size="sm"
              variant="outline"
              colorScheme="danger"
              disabled={isPending}
              onClick={() => remove(row.key)}
            >
              削除
            </Button>
          </Card.Header>
          <Card.Body gap="sm" alignItems="stretch">
            <List.Root fontSize="sm" color="fg.muted">
              {row.issues.map((issue, index) => (
                <List.Item key={index}>
                  {issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""}
                  {issue.message}
                </List.Item>
              ))}
            </List.Root>
            <Code as="pre" display="block" whiteSpace="pre-wrap" wordBreak="break-all" p="sm">
              {JSON.stringify(row.value, null, 2)}
            </Code>
          </Card.Body>
        </Card.Root>
      ))}
    </VStack>
  );
}

/** 「読み込めなかったデータが N 件あります」, with a way to see each row as JSON and remove it. */
export function QuarantineNotice() {
  const { data: storage } = useAtomValue(storageHealthQueryAtom);
  const { open, onOpen, onClose } = useDisclosure();
  const { mutate: remove, isPending } = useAtomValue(deleteQuarantinedAtom);
  const count = storage?.quarantined ?? 0;
  if (count === 0) return null;
  return (
    <>
      <Alert.Root status="warning" role="status" alignItems="center">
        <Alert.Icon />
        <Alert.Description flex="1">読み込めなかったデータが{count}件あります。</Alert.Description>
        <Button variant="outline" bg="bg.panel" size="lg" onClick={onOpen}>
          確認する
        </Button>
      </Alert.Root>
      <Modal.Root open={open} onClose={onClose} size="2xl" scrollBehavior="inside">
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>読み込めなかったデータ</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <QuarantinedRows />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={onClose}>
              閉じる
            </Button>
            <Button colorScheme="danger" loading={isPending} onClick={() => remove(undefined)}>
              すべて削除
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
