import {
  type Plan,
  PlanSchema,
  type Profile,
  ProfileSchema,
  type Shop,
  ShopSchema,
} from "@workspaces/domain";
import * as v from "valibot";
import type { Repository } from "./repository";

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Validates on write and hands out copies, ordered by id, like the IndexedDB implementation. */
export function createMemoryRepository(
  initial: { plans?: Plan[]; shops?: Shop[]; profile?: Profile } = {},
): Repository {
  const plans = new Map<string, Plan>();
  const shops = new Map<string, Shop>();
  let profile: Profile | undefined;

  const putPlan = (plan: Plan) => {
    const parsed = v.parse(PlanSchema, structuredClone(plan));
    plans.set(parsed.id, parsed);
  };
  const putShop = (shop: Shop) => {
    const parsed = v.parse(ShopSchema, structuredClone(shop));
    shops.set(parsed.id, parsed);
  };
  const putProfile = (next: Profile) => {
    profile = v.parse(ProfileSchema, structuredClone(next));
  };

  initial.plans?.forEach(putPlan);
  initial.shops?.forEach(putShop);
  if (initial.profile) putProfile(initial.profile);

  return {
    plans: {
      list: async () => structuredClone([...plans.values()].sort(byId)),
      get: async (id) => structuredClone(plans.get(id)),
      put: async (plan) => putPlan(plan),
      delete: async (id) => {
        plans.delete(id);
      },
    },
    shops: {
      list: async () => structuredClone([...shops.values()].sort(byId)),
      put: async (shop) => putShop(shop),
    },
    profile: {
      get: async () => structuredClone(profile),
      put: async (next) => putProfile(next),
    },
    quarantined: async () => 0,
    wasReset: () => false,
  };
}
