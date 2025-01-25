import { FC, useEffect, useRef, useState } from "react";

/**
 * 数値が増減したときにアニメーションで表示するコンポーネント
 * @param count 数値
 * @param duration アニメーション時間
 * @returns アニメーションで変動する数値
 */
export const CountNumber: FC<{ count: number; duration: number }> = ({ count, duration }) => {
  const [displayValue, setDisplayValue] = useState(count); // 表示用の値
  const previousCount = useRef(count); // 前回の値を保持
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (count === previousCount.current) return;

    const start = previousCount.current; // 前回の値
    const end = count; // 新しい値
    const diff = end - start; // 差分
    previousCount.current = count;

    const step = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;

      // 緩やかな進行のためにイージングを適用
      const progress = Math.min(elapsed / duration, 1); // 0から1の範囲に正規化
      const easedProgress = 1 - Math.pow(1 - progress, 3); // イージング関数

      setDisplayValue(start + diff * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        startTime.current = null;
      }
    };

    requestAnimationFrame(step);
  }, [count, duration]);

  return <>{displayValue.toFixed(1)}</>;
};
