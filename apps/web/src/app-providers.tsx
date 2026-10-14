import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { Modal, Text } from "@workspaces/ui";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import { type ReactNode, useState } from "react";
import { repositoryAtom } from "./state/repository";
import { createIndexedDbRepository } from "./storage/indexed-db-repository";
import { createMemoryRepository } from "./storage/memory-repository";
import { OutdatedDatabaseError } from "./storage/repository";

/** Device data stays out of the HTML rendered ahead of time: the server gets an empty repository. */
function HydrateRepository({ children }: { children: ReactNode }) {
  const [repository] = useState(() =>
    typeof window === "undefined" ? createMemoryRepository() : createIndexedDbRepository(),
  );
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

/** A newer version of the app took over the stored data: nothing works until this page reloads. */
function OutdatedDialog({ open }: { open: boolean }) {
  return (
    <Modal.Root
      open={open}
      closeOnOverlay={false}
      closeOnEsc={false}
      withCloseButton={false}
      title="新しい版に更新されました"
      body={<Text>別のタブで新しい版のアプリが開かれました。再読み込みすると続けられます。</Text>}
      footerProps={{ justifyContent: "center" }}
      success={{ children: "再読み込み", colorScheme: "primary" }}
      onSuccess={() => window.location.reload()}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [outdated, setOutdated] = useState(false);
  const [client] = useState(() => {
    const onError = (error: unknown) => {
      if (error instanceof OutdatedDatabaseError) setOutdated(true);
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
    });
  });
  return (
    <QueryClientAtomProvider client={client}>
      <HydrateRepository>{children}</HydrateRepository>
      <OutdatedDialog open={outdated} />
    </QueryClientAtomProvider>
  );
}
