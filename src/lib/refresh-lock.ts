const LOCK_NAME = "wa.refresh";

/** Fallback queue, used only when Web Locks is unavailable. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Serializes refresh-token rotation.
 *
 * The API rotates the refresh token on every use and reads a replayed token as
 * theft, revoking the user's whole session on every device. Two requests racing
 * on a 401 — or two tabs — would send the same token twice and log the operator
 * out with no explanation.
 *
 * Web Locks serializes across tabs of the same origin, which is exactly where an
 * in-memory queue fails. It is secure-context only, so serving the app over
 * plain HTTP loses it — a normal condition on a small office LAN, not an exotic
 * one. There we degrade to serializing inside this tab, and say so out loud.
 */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task) as Promise<T>;
  }

  console.warn(
    "Web Locks is unavailable — it needs a secure context. Refresh-token rotation is serialized inside this tab " +
      "only, not across tabs. Serve the app over HTTPS.",
  );

  // `run.catch` is what keeps a failed task from wedging the queue: it guarantees
  // the tail is always a settled, never-rejecting promise.
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);

  return run;
}
