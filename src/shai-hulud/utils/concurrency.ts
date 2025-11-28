export async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];

  const queue = items.map((item, index) => ({ item, index }));
  const workers: Array<Promise<void>> = [];
  const results = new Array<R>(items.length);

  const worker = async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;

      const { item, index } = next;
      const res = await fn(item);
      results[index] = res;
    }
  };

  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
