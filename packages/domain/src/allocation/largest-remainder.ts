export function largestRemainder(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const effective = sum === 0 ? weights.map(() => 1) : weights;
  const effectiveSum = sum === 0 ? weights.length : sum;

  const shares = effective.map((w, index) => ({
    index,
    base: Math.floor((total * w) / effectiveSum),
    remainder: (total * w) % effectiveSum,
  }));
  const result = shares.map((s) => s.base);
  const leftover = total - result.reduce((a, b) => a + b, 0);

  const order = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < leftover; i++) {
    const target = order[i];
    if (target) result[target.index] = (result[target.index] ?? 0) + 1;
  }
  return result;
}
