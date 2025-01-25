import { useCallback, useEffect, type RefCallback, type RefObject } from "react";

type TargetElement = Window | Document | HTMLElement;

type EventMap<T extends TargetElement> = T extends Window
  ? WindowEventMap
  : T extends Document
    ? DocumentEventMap
    : HTMLElementEventMap;

/**
 * イベントハンドラを登録する
 * @param eventName イベント名
 * @param handler イベントハンドラ
 * @param target イベントを登録する要素 (未指定はdocument)
 * @param options イベントリスナーのオプション
 */
export const useEventListener = <
  T extends TargetElement,
  EventName extends keyof EventMap<T> & string,
>(
  eventName: EventName,
  handler: (event: EventMap<T>[EventName]) => unknown,
  target: T | RefObject<T> = document as T,
  options?: Omit<AddEventListenerOptions, "signal">,
) => {
  useEffect(() => {
    const targetElement = target instanceof Object && "current" in target ? target.current : target;
    const controller = new AbortController();
    targetElement.addEventListener(eventName, handler as EventListener, {
      signal: controller.signal,
      ...options,
    });

    return () => controller.abort();
  }, [eventName, handler, options, target]);
};

/**
 * イベントハンドラをDOM要素に登録するためのRefコールバックを生成する
 * @param eventName イベント名
 * @param handlerFactory イベントハンドラを生成するファクトリ関数
 * @param options イベントリスナーのオプション
 */
export const useRefEventCallback = <
  EventName extends keyof HTMLElementEventMap,
  TargetElement extends HTMLElement = HTMLElement,
>(
  eventName: EventName,
  handlerFactory: (node: TargetElement) => (event: HTMLElementEventMap[EventName]) => unknown,
  options?: Omit<AddEventListenerOptions, "signal">,
): RefCallback<TargetElement> =>
  useCallback(
    (node) => {
      const handler = handlerFactory(node!);
      const controller = new AbortController();
      node!.addEventListener(eventName, handler, {
        signal: controller.signal,
        ...options,
      });
      return () => {
        controller.abort();
      };
    },
    [eventName, handlerFactory, options],
  );
