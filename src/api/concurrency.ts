export interface RunWithConcurrencyArgs<T> {
  items: T[];
  concurrency: number;
  signal?: AbortSignal;
  worker: (item: T, index: number) => Promise<void>;
}

export async function runWithConcurrency<T>({
  items,
  concurrency,
  signal,
  worker,
}: RunWithConcurrencyArgs<T>): Promise<void> {
  const limit = Math.max(1, concurrency);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (signal?.aborted) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}
