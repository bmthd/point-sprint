import { ClientOnly } from "@tanstack/react-router";
import { toggleBenefits } from "@workspaces/domain";
import { Alert, Box, Card, Heading, Text, VStack } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { saveProfileAtom } from "../../state/mutations";
import { profileAtom, profileQueryAtom, storageHealthQueryAtom } from "../../state/queries";
import { BackIcon } from "../plan-home/icons";
import { StorageHealthFailure, storageMessages } from "../plan-home/warnings";
import { RouterLink } from "../plan-list/router-link";
import { SpuTileGrid } from "../plan-settings/spu-tiles";
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
    </VStack>
  );
}

/** The profile at `/profile`: SPU defaults for new plans and the shop registry. */
export function Profile() {
  return (
    <Box bg="bg" color="fg" minH="100dvh">
      <Box
        as="header"
        maxW="640px"
        mx="auto"
        h="14"
        display="flex"
        alignItems="center"
        gap="1"
        px="2"
      >
        <RouterLink
          to="/"
          aria-label="戻る"
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
        <Heading as="h1" fontSize="lg">
          プロフィール
        </Heading>
      </Box>
      <Box as="main" maxW="640px" mx="auto" px="4" pt="1" pb="16">
        <ClientOnly>
          <ProfileContent />
        </ClientOnly>
      </Box>
    </Box>
  );
}
