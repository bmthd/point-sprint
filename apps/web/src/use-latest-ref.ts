import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * A ref that holds the `value` of the last render, for callbacks that run later (a timer, a
 * subscription) and must see the current value without being made again. It is updated once the
 * render is committed, so it is not read during render.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
