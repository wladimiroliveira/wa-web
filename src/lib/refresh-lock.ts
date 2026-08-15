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

  // `run.catch` is the line that keeps a failed task from wedging the queue: it
  // is what guarantees the tail is always a settled, never-rejecting promise.
  // The `onRejected` slot in `then(task, task)` is therefore unreachable as the
  // code stands: it is insurance against a future edit dropping the catch, not
  // the mechanism that makes this work.
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
