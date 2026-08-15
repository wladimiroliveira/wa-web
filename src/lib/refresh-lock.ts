const LOCK_NAME = "wa.refresh";

/** Fallback queue, used only when Web Locks is unavailable. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Serializes refresh-token rotation.
 *
 * The API rotates the refresh token on every use and treats a replayed token as
 * theft, revoking the whole session. Two requests racing on a 401 — or two
 * browser tabs — would send the same token twice and log the user out with no
 * explanation.
 *
 * Web Locks serializes across tabs of the same origin, which is exactly where an
 * in-memory queue would fail. Without it, we degrade to serializing inside this
 * tab only; that is a known, documented limitation rather than a silent one.
 */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task);
  }

  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
