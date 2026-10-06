import { atom } from "jotai";
import { createMemoryRepository } from "../storage/memory-repository";
import type { Repository } from "../storage/repository";

/** Starts empty so the server render never touches device storage; `AppProviders` swaps in IndexedDB. */
export const repositoryAtom = atom<Repository>(createMemoryRepository());
