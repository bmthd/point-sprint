/**
 * The indexes into `values` of a longest strictly increasing subsequence.
 */
function longestIncreasing(values: readonly number[]): Set<number> {
  // tails[k]: the index of the smallest value ending an increasing run of length k + 1.
  const tails: number[] = [];
  const previous: number[] = Array.from({ length: values.length }, () => -1);
  values.forEach((value, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tails[middle]!]! < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1]!;
    tails[low] = index;
  });
  const kept = new Set<number>();
  for (let index = tails.at(-1) ?? -1; index !== -1; index = previous[index]!) kept.add(index);
  return kept;
}

/**
 * The position of each order of a plan listed as `ids`, given the positions they had. As many
 * orders as can keep their position do, so that moving one order changes that order only: on
 * another device, an order whose position changed counts as edited and would win over an edit
 * made there.
 */
export function orderPositions(
  previous: ReadonlyMap<string, number>,
  ids: readonly string[],
): Map<string, number> {
  const known = ids.flatMap((id, index) => {
    const position = previous.get(id);
    return position === undefined ? [] : [{ index, position }];
  });
  const keptIndexes = longestIncreasing(known.map(({ position }) => position));
  const kept = new Map(
    known.filter((_, k) => keptIndexes.has(k)).map(({ index, position }) => [index, position]),
  );

  const next = new Map<string, number>();
  let before: number | undefined;
  ids.forEach((id, index) => {
    const own = kept.get(index);
    if (own !== undefined) {
      next.set(id, own);
      before = own;
      return;
    }
    let after: number | undefined;
    for (let later = index + 1; later < ids.length && after === undefined; later++) {
      after = kept.get(later);
    }
    const position =
      before === undefined
        ? after === undefined
          ? 0
          : after - 1
        : after === undefined
          ? before + 1
          : (before + after) / 2;
    next.set(id, position);
    before = position;
  });
  return next;
}
