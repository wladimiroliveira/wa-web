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
 * in-memory queue would fail. It is secure-context only, so a deployment over
 * plain HTTP loses it — a normal condition on a small office LAN, not an exotic
 * one. Without it we degrade to serializing inside this tab, and say so out loud.
 */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task);
  }

  console.warn(
    "Web Locks is unavailable — it needs a secure context. Refresh-token rotation is serialized inside this tab only, " +
      "not across tabs. Serve the app over HTTPS.",
  );

  // `run.catch` is the line that keeps a failed task from wedging the queue: it
  // is what guarantees the tail is always a settled, never-rejecting promise.
  // The `onRejected` slot in `then(task, task)` is therefore unreachable as the
  // code stands: it is insurance against a future edit dropping the catch, not
  // the mechanism that makes this work.
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}
