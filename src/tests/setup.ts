import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "@/tests/msw-server";
import { removeWebLocks, serializingLocks, useWebLocks } from "@/tests/web-locks";

// `onUnhandledRequest: "error"` is deliberate: a test reaching an endpoint nobody
// declared should fail loudly, not silently hit the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
  // Every suite runs the branch a browser runs, without each file having to remember.
  useWebLocks(serializingLocks());
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  removeWebLocks();
});

afterAll(() => server.close());
