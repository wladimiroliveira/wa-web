import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { server } from "@/tests/msw-server";
import { navigation } from "@/tests/navigation";
import { removeWebLocks, serializingLocks, useWebLocks } from "@/tests/web-locks";

// Every component reads the address through this in-memory router; see `tests/navigation.ts`.
vi.mock("next/navigation", () => import("@/tests/navigation"));

// jsdom has no `matchMedia`, and the app shell asks it whether the screen is a
// phone. Nothing matches, so every suite renders the wide layout.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// `onUnhandledRequest: "error"` is deliberate: a test reaching an endpoint nobody
// declared should fail loudly, not silently hit the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
  // Every suite runs the branch a browser runs, without each file having to remember.
  useWebLocks(serializingLocks());
  navigation.reset();
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  removeWebLocks();
});

afterAll(() => server.close());
