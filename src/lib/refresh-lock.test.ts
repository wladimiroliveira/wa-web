import { afterEach, describe, expect, test, vi } from "vitest";
import { withRefreshLock } from "@/lib/refresh-lock";

/** A minimal serial stand-in for the real Web Locks API, which jsdom lacks. */
function installLocksStub() {
  let chain: Promise<unknown> = Promise.resolve();
  const request = vi.fn(<T>(_name: string, task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  });

  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  return request;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "locks");
});

describe("withRefreshLock with Web Locks available", () => {
  test("routes the task through navigator.locks under a namespaced lock", async () => {
    const request = installLocksStub();

    await expect(withRefreshLock(async () => "done")).resolves.toBe("done");

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("wa.refresh");
  });

  test("runs tasks one at a time, never overlapping", async () => {
    installLocksStub();
    const events: string[] = [];

    const task = (name: string) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push(`${name}:end`);
      return name;
    };

    await Promise.all([withRefreshLock(task("a")), withRefreshLock(task("b"))]);

    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });
});

describe("withRefreshLock without Web Locks", () => {
  test("still serializes inside the tab", async () => {
    const events: string[] = [];

    const task = (name: string) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push(`${name}:end`);
      return name;
    };

    await Promise.all([withRefreshLock(task("a")), withRefreshLock(task("b"))]);

    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  test("warns, so the lost cross-tab guarantee is observable instead of inferred", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await withRefreshLock(async () => "done");

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("a rejected task does not wedge the queue for the next caller", async () => {
    await expect(withRefreshLock(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(withRefreshLock(async () => "recovered")).resolves.toBe("recovered");
  });
});
