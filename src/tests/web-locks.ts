export type LockRequest = (name: string, task: () => Promise<unknown>) => Promise<unknown>;

/** Installs a Web Locks stand-in, since jsdom implements none. */
export function useWebLocks(request: LockRequest): void {
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

export function removeWebLocks(): void {
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
}

/**
 * A stand-in that serializes, because that is what a lock IS. A pass-through double
 * would run every caller at once and let racing requests each fire their own refresh
 * — the exact failure the single-flight test exists to catch, hidden behind a green
 * suite.
 */
export function serializingLocks(): LockRequest {
  const tails = new Map<string, Promise<unknown>>();

  return (name, task) => {
    const previous = tails.get(name) ?? Promise.resolve();
    const run = previous.then(task, task);

    tails.set(
      name,
      run.catch(() => undefined),
    );

    return run;
  };
}
