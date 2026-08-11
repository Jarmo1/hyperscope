/**
 * Run tasks with a bounded worker pool. Hyperliquid budgets roughly 1200
 * request-weight per minute per IP and `clearinghouseState` costs 2, so wide
 * scans have to be throttled rather than fired all at once.
 *
 * Failures resolve to null rather than rejecting: one bad wallet must never
 * take down a scan of several hundred.
 */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await fn(items[index], index);
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
