import { DurableObject } from "cloudflare:workers";
import { type Turn, takeTurn } from "./rate-gate";

/**
 * Hands out the turns at the Rakuten API (`takeTurn`). The Worker uses one of it for every user
 * (`idFromName`). The next free time is kept in memory only: when the object is reset, it starts
 * from now, which only lets the next call go at once.
 */
export class RakutenRateGate extends DurableObject {
  #nextFreeAt = 0;

  take(maxWaitMs: number): Turn {
    const { turn, nextFreeAt } = takeTurn(this.#nextFreeAt, Date.now(), maxWaitMs);
    this.#nextFreeAt = nextFreeAt;
    return turn;
  }
}
