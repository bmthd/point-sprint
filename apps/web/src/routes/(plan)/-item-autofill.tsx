import { channels, parseUrl } from "@workspaces/domain";
import { Box, Text } from "@workspaces/ui";
import { atom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { browserItemLookup } from "../../rakuten/browser";
import type { ItemLookup } from "../../rakuten/item-lookup";
import type { ItemPage, RakutenItem } from "../../rakuten/item-search";
import { useLatestRef } from "../../use-latest-ref";

/**
 * The lookup of an item page, or `undefined` when the build has no Rakuten settings. Wrapped in an
 * object: an atom made from a function would take it for a getter.
 */
export const itemLookupAtom = atom<{ lookup: ItemLookup | undefined }>({
  lookup: browserItemLookup(),
});

export type AutofillStatus = "idle" | "loading" | "failed";

/** How long typing has to pause before a typed URL is looked up. A paste is one change. */
const TYPING_PAUSE_MS = 300;

/** The item page to look up for a URL, on a channel that supports the lookup. */
export function itemPageOf(url: string): ItemPage | null {
  const parsed = parseUrl(url.trim());
  if (!parsed || !channels[parsed.channel].supportsItemLookup) return null;
  const { shopCode, itemManageNumber } = parsed;
  return shopCode && itemManageNumber ? { shopCode, itemManageNumber } : null;
}

/**
 * Looks up the item of a URL given to `onUrl` and hands it to `apply`. Only the last URL counts:
 * an answer for an earlier one is dropped.
 */
export function useItemAutofill(apply: (item: RakutenItem) => void) {
  const { lookup } = useAtomValue(itemLookupAtom);
  const [status, setStatus] = useState<AutofillStatus>("idle");
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const applyRef = useLatestRef(apply);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      latest.current += 1;
    },
    [],
  );

  const onUrl = (url: string) => {
    const request = ++latest.current;
    clearTimeout(timer.current);
    const page = itemPageOf(url);
    if (!lookup || !page) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(() => {
      void lookup(page).then((result) => {
        if (request !== latest.current) return;
        if (result.ok) applyRef.current(result.item);
        setStatus(result.ok ? "idle" : "failed");
      });
    }, TYPING_PAUSE_MS);
  };

  /** Forgets the URL being looked up, as when the form is emptied. */
  const reset = () => {
    latest.current += 1;
    clearTimeout(timer.current);
    setStatus("idle");
  };

  return { status, onUrl, reset };
}

/**
 * 「商品情報を取得しています」 or 「自動入力できませんでした」, for under the URL field. The live
 * region stays in place while it is empty, so what comes into it is announced.
 */
export function AutofillStatusText({ status }: { status: AutofillStatus }) {
  return (
    <Box role="status">
      {status === "idle" ? null : (
        <Text mt="1" fontSize="xs" color={status === "failed" ? "danger.fg" : "fg.muted"}>
          {status === "loading"
            ? "商品情報を取得しています…"
            : "自動入力できませんでした。商品名と金額は手で入れてください。"}
        </Text>
      )}
    </Box>
  );
}
