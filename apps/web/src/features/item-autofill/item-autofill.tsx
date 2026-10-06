import { channels, parseUrl, toItemCode } from "@workspaces/domain";
import { Box, Text } from "@workspaces/ui";
import { atom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { browserItemLookup } from "../../rakuten/browser";
import type { ItemLookup } from "../../rakuten/item-lookup";
import type { RakutenItem } from "../../rakuten/item-search";

/**
 * The lookup of an item code, or `undefined` when the build has no Rakuten settings. Wrapped in an
 * object: an atom made from a function would take it for a getter.
 */
export const itemLookupAtom = atom<{ lookup: ItemLookup | undefined }>({
  lookup: browserItemLookup(),
});

export type AutofillStatus = "idle" | "loading" | "failed";

/** How long typing has to pause before a typed URL is looked up. A paste is one change. */
const TYPING_PAUSE_MS = 300;

/** The item code to look up for a URL: an item page of a channel that supports the lookup. */
export function itemCodeOf(url: string): string | null {
  const parsed = parseUrl(url.trim());
  return parsed && channels[parsed.channel].supportsItemLookup ? toItemCode(parsed) : null;
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
  const applyRef = useRef(apply);
  applyRef.current = apply;

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
    const itemCode = itemCodeOf(url);
    if (!lookup || !itemCode) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(() => {
      void lookup(itemCode).then((result) => {
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
