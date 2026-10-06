import { QueryClient } from "@tanstack/react-query";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import { type ReactNode, useState } from "react";
import { repositoryAtom } from "./state/repository";
import { createIndexedDbRepository } from "./storage/indexed-db-repository";
import { createMemoryRepository } from "./storage/memory-repository";

/** Device data stays out of the HTML rendered ahead of time: the server gets an empty repository. */
function HydrateRepository({ children }: { children: ReactNode }) {
  const [repository] = useState(() =>
    typeof window === "undefined" ? createMemoryRepository() : createIndexedDbRepository(),
  );
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientAtomProvider client={client}>
      <HydrateRepository>{children}</HydrateRepository>
    </QueryClientAtomProvider>
  );
}
