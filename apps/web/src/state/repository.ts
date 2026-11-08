import { atom } from "jotai";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import type { Repository } from "#/storage/repository.ts";

/** Starts empty so the server render never touches device storage; `AppProviders` swaps in IndexedDB. */
export const repositoryAtom = atom<Repository>(createMemoryRepository());
