// The turns at the Rakuten API, which every user's lookups share: the app's application id may make
// 10 calls a second, so each call gets a turn of its own, 100ms after the one before.

export const TURN_MS = 100;

/** Whether a turn was taken, and how long until it comes. */
export type Turn = { granted: boolean; waitMs: number };

/**
 * A turn for a call at `now` that can wait up to `maxWaitMs`, given the time the next turn is free
 * at. A turn further away than that is not taken, and `nextFreeAt` stays.
 */
export function takeTurn(
  nextFreeAt: number,
  now: number,
  maxWaitMs: number,
  turnMs = TURN_MS,
): { turn: Turn; nextFreeAt: number } {
  const at = Math.max(now, nextFreeAt);
  const waitMs = at - now;
  if (waitMs > maxWaitMs) return { turn: { granted: false, waitMs }, nextFreeAt };
  return { turn: { granted: true, waitMs }, nextFreeAt: at + turnMs };
}
