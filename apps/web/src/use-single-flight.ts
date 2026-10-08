import { useRef } from "react";

/** Runs one asynchronous operation at a time, dropping calls made while it is pending. */
export function useSingleFlight() {
  const runningRef = useRef(false);

  return async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (runningRef.current) return undefined;
    runningRef.current = true;
    try {
      return await operation();
    } finally {
      runningRef.current = false;
    }
  };
}
