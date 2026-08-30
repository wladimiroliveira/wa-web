import { afterEach, describe, expect, it, vi } from "vitest";
import { withRefreshLock } from "@/lib/refresh-lock";

function giveWebLocks(request: (name: string, task: () => Promise<unknown>) => Promise<unknown>): void {
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

function takeWebLocksAway(): void {
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
};

afterEach(() => {
  takeWebLocksAway();
  vi.restoreAllMocks();
});

describe("withRefreshLock", () => {
  it("delegates to Web Locks under a fixed name, so every tab contends for the same lock", async () => {
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => task());
    giveWebLocks(request);

    await expect(withRefreshLock(async () => "rotated")).resolves.toBe("rotated");
    expect(request).toHaveBeenCalledWith("wa.refresh", expect.any(Function));
  });

  it("serializes tasks inside the tab when Web Locks is unavailable", async () => {
    takeWebLocksAway();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const order: string[] = [];
    const first = deferred();

    const one = withRefreshLock(async () => {
      order.push("first started");
      await first.promise;
      order.push("first finished");
    });
    const two = withRefreshLock(async () => {
      order.push("second started");
    });

    first.resolve();
    await Promise.all([one, two]);

    expect(order).toEqual(["first started", "first finished", "second started"]);
  });

  it("warns out loud that cross-tab serialization was lost", async () => {
    takeWebLocksAway();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await withRefreshLock(async () => undefined);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTPS"));
  });

  it("does not wedge the queue when a task rejects", async () => {
    takeWebLocksAway();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(withRefreshLock(async () => Promise.reject(new Error("refresh failed")))).rejects.toThrow(
      "refresh failed",
    );
    await expect(withRefreshLock(async () => "still works")).resolves.toBe("still works");
  });
});
