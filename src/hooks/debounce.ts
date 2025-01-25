import { useEffect, useRef } from "react";

/**
 * コンポーネントレンダリング間で保持した遅延秒数経過後に1度だけ実行したい処理を実行する関数を返す
 * @returns debounce関数
 */
export const useDebounce = () => {
  const timeoutRef = useRef<number>(0);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return (fn: () => void, delay: number) => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(fn, delay);
  };
};
