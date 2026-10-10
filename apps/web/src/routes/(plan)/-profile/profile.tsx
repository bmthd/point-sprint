import { ClientOnly, useCanGoBack, useRouter } from "@tanstack/react-router";
import { toggleBenefits } from "@workspaces/domain";
import { Alert, Box, Flex, Card, Heading, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { saveProfileAtom } from "../../../state/mutations";
import { profileAtom, profileQueryAtom, storageHealthQueryAtom } from "../../../state/queries";
import { BackIcon } from "../../../ui/icons";
import { RouterLink } from "../../../ui/router-link";
import { StorageHealthFailure, storageMessages } from "../-warnings";
import { SpuTileGrid } from "../-plan-settings/spu-tiles";
import { AccountSettings } from "./account-settings";
import { ShopRegistry } from "./shop-registry";

const noneCapped: ReadonlySet<string> = new Set();

function StorageNotice() {
  const { data } = useAtomValue(storageHealthQueryAtom);
  const messages = storageMessages(data);
  return (
    <VStack gap="2" alignItems="stretch" _empty={{ display: "none" }}>
      <StorageHealthFailure />
      {messages.map((message) => (
        <Alert.Root key={message} status="warning" role="status">
          <Alert.Icon />
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      ))}
    </VStack>
  );
}

function SpuDefaults({ onFailed }: { onFailed: (failed: boolean) => void }) {
  const profile = useAtomValue(profileAtom);
  const { isSuccess } = useAtomValue(profileQueryAtom);
  const { mutateAsync: saveProfile } = useAtomValue(saveProfileAtom);
  return (
    <Card.Root as="section" aria-labelledby="spu-defaults-title">
      <Card.Body alignItems="stretch">
        <Text as="h2" id="spu-defaults-title" fontSize="md" fontWeight="bold">
          SPU の初期値
        </Text>
        <Text fontSize="xs" color="fg.muted">
          ここでの変更は、これから作るプランの初期値になります。作成済みのプランは変わりません。
        </Text>
        {isSuccess ? (
          <SpuTileGrid
            benefits={profile.spuBenefits}
            capped={noneCapped}
            onToggle={(benefitId) => {
              onFailed(false);
              saveProfile({
                change: (current) => ({
                  ...current,
                  spuBenefits: toggleBenefits(current.spuBenefits, benefitId),
                }),
              }).catch(() => onFailed(true));
            }}
          />
        ) : (
          <Text role="status" fontSize="sm" color="fg.muted">
            読み込み中…
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function ProfileContent() {
  const [failed, setFailed] = useState(false);
  return (
    <VStack gap="5" alignItems="stretch">
      <StorageNotice />
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          変更を保存できませんでした。もう一度お試しください。
        </Text>
      ) : null}
      <SpuDefaults onFailed={setFailed} />
      <ShopRegistry onFailed={setFailed} />
      <AccountSettings onFailed={setFailed} />
    </VStack>
  );
}

/** Back to the page the profile was opened from, or to the top when it was opened directly. */
function BackLink() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <RouterLink
      to="/"
      aria-label="戻る"
      onClick={(event) => {
        if (!canGoBack) return;
        event.preventDefault();
        router.history.back();
      }}
      boxSize="11"
      display="flex"
      alignItems="center"
      justifyContent="center"
      rounded="xl"
      color="fg"
      _hover={{ bg: "bg.muted" }}
    >
      <BackIcon />
    </RouterLink>
  );
}

/**
 * The profile at `/profile`: SPU defaults for new plans, the shop registry and advanced settings.
 * Its title bar is the plan settings page's: a page that goes back where it was opened from.
 */
export function Profile() {
  return (
    <>
      <Flex maxW="640px" mx="auto" h="14" align="center" gap="1" px="2">
        <BackLink />
        <Heading as="h1" fontSize="lg">
          プロフィール
        </Heading>
      </Flex>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="16">
        <ClientOnly>
          <ProfileContent />
        </ClientOnly>
      </Box>
    </>
  );
}
