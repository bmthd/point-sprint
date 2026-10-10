import { useRouter } from "@tanstack/react-router";
import { Button, HStack, TriangleAlertIcon } from "@workspaces/ui";
import { RouterButton } from "../../ui/router-link";
import { StatusPage } from "./status-page";

/** What a page shows when it fails to render or load. The error itself is not shown. */
export function ErrorPage() {
  const router = useRouter();
  return (
    <StatusPage
      indicator={<TriangleAlertIcon />}
      title="エラーが発生しました"
      description="ページを表示できませんでした。入力したデータはこのブラウザに残っています。再読み込みしてもう一度お試しください。"
    >
      <HStack flexWrap="wrap" justifyContent="center">
        <Button colorScheme="primary" size="lg" onClick={() => void router.invalidate()}>
          再読み込み
        </Button>
        <RouterButton to="/" variant="outline" bg="bg.panel" size="lg">
          トップに戻る
        </RouterButton>
      </HStack>
    </StatusPage>
  );
}
