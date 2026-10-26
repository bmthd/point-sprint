import { ClientOnly, useCanGoBack, useRouter } from "@tanstack/react-router";
import { Alert, Box, Flex, Heading, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { storageHealthQueryAtom } from "../../../state/queries";
import { BackIcon } from "../../../ui/icons";
import { RouterIconButton } from "../../../ui/router-link";
import { QuarantineNotice } from "../-quarantine-notice";
import { StorageHealthFailure, storageMessages } from "../-warnings";
import { ResetDataButton } from "../../-reset-data";
import { AccountSettings } from "./account-settings";
import { ShopRegistry } from "./shop-registry";
import { SpuMonthsCard } from "./spu-months-card";
import { SyncSettings } from "./sync-settings";
import type { SyncServer } from "../../../storage/sync-passkey";

function StorageNotice() {
  const { data } = useAtomValue(storageHealthQueryAtom);
  const messages = storageMessages(data);
  return (
    <VStack gap="2" alignItems="stretch" _empty={{ display: "none" }}>
      <StorageHealthFailure />
      <QuarantineNotice />
      {messages.map((message) => (
        <Alert.Root key={message} status="warning" role="status">
          <Alert.Icon />
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      ))}
    </VStack>
  );
}

function ProfileContent({ syncServer }: { syncServer: SyncServer | undefined }) {
  const [failed, setFailed] = useState(false);
  return (
    <VStack gap="5" alignItems="stretch">
      <StorageNotice />
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          変更を保存できませんでした。もう一度お試しください。
        </Text>
      ) : null}
      <SpuMonthsCard />
      {syncServer ? (
        <SyncSettings
          server={syncServer}
          siteKey={import.meta.env.TURNSTILE_SITE_KEY ?? undefined}
        />
      ) : null}
      <ShopRegistry onFailed={setFailed} />
      <AccountSettings onFailed={setFailed} />
      <ResetDataButton />
    </VStack>
  );
}

/** Back to the page the profile was opened from, or to the top when it was opened directly. */
function BackLink() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <RouterIconButton
      to="/"
      aria-label="戻る"
      onClick={(event) => {
        if (!canGoBack) return;
        event.preventDefault();
        router.history.back();
      }}
      size="lg"
      variant="ghost"
      icon={<BackIcon />}
    />
  );
}

/**
 * 共通設定 at `/profile`: what every plan shares, the SPU of each month, the sync with other
 * devices, the shop registry and advanced settings. Without `syncServer`, as in the tests, no sync.
 * Its title bar is the plan settings page's: a page that goes back where it was opened from.
 */
export function Profile({ syncServer }: { syncServer?: SyncServer } = {}) {
  return (
    <>
      <Flex maxW="640px" mx="auto" h="14" align="center" gap="1" px="2">
        <BackLink />
        <Heading as="h1" fontSize="lg">
          共通設定
        </Heading>
      </Flex>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="16">
        <ClientOnly>
          <ProfileContent syncServer={syncServer} />
        </ClientOnly>
      </Box>
    </>
  );
}
