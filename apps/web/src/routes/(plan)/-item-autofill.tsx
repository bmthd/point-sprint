import { channels, parseUrl } from "@workspaces/domain";
import { Box, Button, HStack, Link, Text, VStack } from "@workspaces/ui";
import { atom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  FIRST_MAX_WAIT_MS,
  type ItemLookup,
  type ItemLookupResult,
  LONGEST_WAIT_MS,
} from "../../rakuten/item-lookup";
import type { ItemPage, RakutenItem } from "../../rakuten/item-search";
import { useLatestRef } from "../../use-latest-ref";

/**
 * The lookup of an item page, or `undefined` for none. The plan page puts in the lookup through the
 * Worker (`-worker-item-lookup.ts`); tests give their own. Wrapped in an object: an atom made from a
 * function would take it for a getter.
 */
export const itemLookupAtom = atom<{ lookup: ItemLookup | undefined }>({ lookup: undefined });

/** What the lookup of the URL's item is doing, as the status under the URL field shows it. */
export type AutofillState =
  | { kind: "idle" }
  | { kind: "loading" }
  /** Its turn at the API was too far away for the first lookup, but can be waited for. */
  | { kind: "busy"; waitMs: number }
  /** Asking whether to wait `waitMs` for it. */
  | { kind: "confirm"; waitMs: number }
  /** Waiting for it, which was to take `waitMs` from `since`. */
  | { kind: "waiting"; waitMs: number; since: number }
  /** Its turn is further away than a user is asked to wait. */
  | { kind: "too-busy" }
  | { kind: "failed" };

const IDLE: AutofillState = { kind: "idle" };

/** The item page to look up for a URL, on a channel that supports the lookup. */
export function itemPageOf(url: string): ItemPage | null {
  const parsed = parseUrl(url.trim());
  if (!parsed || !channels[parsed.channel].supportsItemLookup) return null;
  const { shopCode, itemManageNumber } = parsed;
  return shopCode && itemManageNumber ? { shopCode, itemManageNumber } : null;
}

const keyOf = (page: ItemPage | null) =>
  page ? `${page.shopCode}/${page.itemManageNumber}` : undefined;

/** The state a failed lookup leaves. */
function failedState(result: Extract<ItemLookupResult, { ok: false }>): AutofillState {
  const { error } = result;
  if (error.reason !== "busy") return { kind: "failed" };
  return error.waitMs <= LONGEST_WAIT_MS
    ? { kind: "busy", waitMs: error.waitMs }
    : { kind: "too-busy" };
}

/**
 * Looks up the item of the URL field and hands it to `apply`. A pasted URL is looked up at once, a
 * typed one when the field is left or Enter is pressed (`onUrlCommit`). The item looked up last is
 * not looked up again. Only the URL in the field counts: an answer for an earlier one is dropped.
 */
export function useItemAutofill(apply: (item: RakutenItem) => void) {
  const { lookup } = useAtomValue(itemLookupAtom);
  const [state, setState] = useState<AutofillState>(IDLE);
  const request = useRef(0);
  const controller = useRef<AbortController>(undefined);
  /** The item page the state is about. */
  const current = useRef<ItemPage>(undefined);
  const applyRef = useLatestRef(apply);

  /** Drops the lookup on its way, letting its turn at the API go. */
  const abandon = () => {
    request.current += 1;
    controller.current?.abort();
    controller.current = undefined;
  };

  useEffect(() => abandon, []);

  const start = (page: ItemPage, maxWaitMs: number, waiting: AutofillState) => {
    if (!lookup) return;
    abandon();
    const id = request.current;
    const aborter = new AbortController();
    controller.current = aborter;
    setState(waiting);
    void lookup(page, { maxWaitMs, signal: aborter.signal }).then((result) => {
      if (id !== request.current) return;
      controller.current = undefined;
      if (result.ok) applyRef.current(result.item);
      setState(result.ok ? IDLE : failedState(result));
    });
  };

  /** Looks up the URL's item unless it was the last one looked up. Says whether it did. */
  const lookUp = (url: string) => {
    const page = itemPageOf(url);
    if (!lookup || !page || keyOf(page) === keyOf(current.current ?? null)) return false;
    current.current = page;
    start(page, FIRST_MAX_WAIT_MS, { kind: "loading" });
    return true;
  };

  /**
   * Every change of the URL field. A paste is looked up at once; a change to another item page
   * drops what the state said about the last one.
   */
  const onUrlChange = (url: string, pasted: boolean) => {
    if (keyOf(itemPageOf(url)) !== keyOf(current.current ?? null)) {
      abandon();
      current.current = undefined;
      setState(IDLE);
    }
    if (pasted) lookUp(url);
  };

  /** The field was left or Enter was pressed. Says whether a lookup started. */
  const onUrlCommit = (url: string) => lookUp(url);

  /** 「待って取得する」: asks whether to wait. */
  const offerWait = () => {
    if (state.kind === "busy") setState({ kind: "confirm", waitMs: state.waitMs });
  };

  /** 「約 N 秒待つ」: looks the item up again, ready to wait for its turn. */
  const wait = () => {
    if (state.kind !== "confirm" || !current.current) return;
    start(current.current, LONGEST_WAIT_MS, {
      kind: "waiting",
      waitMs: state.waitMs,
      since: Date.now(),
    });
  };

  /** 「やめる」: stops waiting, back to 「混み合っているため…」. */
  const cancel = () => {
    if (state.kind !== "confirm" && state.kind !== "waiting") return;
    abandon();
    setState({ kind: "busy", waitMs: state.waitMs });
  };

  /** Forgets the URL being looked up, as when the form is emptied. */
  const reset = () => {
    abandon();
    current.current = undefined;
    setState(IDLE);
  };

  return { state, onUrlChange, onUrlCommit, offerWait, wait, cancel, reset };
}

export type ItemAutofill = ReturnType<typeof useItemAutofill>;

/** Whole seconds, rounded up, so that 「あと 0 秒」 is never shown while still waiting. */
const seconds = (ms: number) => Math.ceil(ms / 1000);

/** The seconds left of a wait, counted down each second; 0 once it is over. */
function useSecondsLeft(state: AutofillState) {
  const [now, setNow] = useState(() => Date.now());
  const waiting = state.kind === "waiting";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [waiting]);
  if (state.kind !== "waiting") return 0;
  return Math.max(0, seconds(state.waitMs - Math.max(0, now - state.since)));
}

/**
 * Why the item is not filled in, or what the lookup is doing, under the URL field. Its height stays
 * the same in every state, also while it is empty, so that the fields under it never move. The live
 * region stays in place while it is empty, so what comes into it is announced.
 */
export function AutofillStatus({ autofill }: { autofill: ItemAutofill }) {
  const { state } = autofill;
  const secondsLeft = useSecondsLeft(state);
  const message = (text: string, color = "fg.muted") => (
    <Text fontSize="xs" color={color}>
      {text}
    </Text>
  );

  return (
    // Two lines of text and a row of buttons: the tallest state on a phone.
    <Box role="status" mt="1" h="5.5rem" overflow="hidden">
      {state.kind === "loading" ? message("商品情報を取得しています…") : null}
      {state.kind === "busy" ? (
        <VStack gap="0" alignItems="flex-start">
          {message("混み合っているため、自動入力を止めました。商品名と金額は手で入れてください。")}
          <Link as="button" type="button" fontSize="xs" minH="10" onClick={autofill.offerWait}>
            待って取得する
          </Link>
        </VStack>
      ) : null}
      {state.kind === "confirm" ? (
        <VStack gap="2" alignItems="flex-start">
          {message(
            `取得まで約 ${seconds(state.waitMs)} 秒かかります。待つ間も手で入れられます。`,
            "fg",
          )}
          <HStack gap="2">
            <Button type="button" colorScheme="primary" onClick={autofill.wait}>
              約 {seconds(state.waitMs)} 秒待つ
            </Button>
            <Button type="button" variant="outline" onClick={autofill.cancel}>
              やめる
            </Button>
          </HStack>
        </VStack>
      ) : null}
      {state.kind === "waiting" ? (
        <HStack gap="2" justifyContent="space-between">
          {message(
            secondsLeft > 0
              ? `商品情報を取得しています… あと ${secondsLeft} 秒`
              : "商品情報を取得しています…",
          )}
          <Button type="button" variant="outline" flex="none" onClick={autofill.cancel}>
            やめる
          </Button>
        </HStack>
      ) : null}
      {state.kind === "too-busy"
        ? message(
            "混み合っていて待ち時間が長いため、自動入力を止めました。商品名と金額は手で入れてください。",
          )
        : null}
      {state.kind === "failed"
        ? message("自動入力できませんでした。商品名と金額は手で入れてください。", "danger.fg")
        : null}
    </Box>
  );
}
