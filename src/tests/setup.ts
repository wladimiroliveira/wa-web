import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/tests/msw-server";

// `onUnhandledRequest: "error"` is deliberate: a test that reaches an endpoint
// nobody declared should fail loudly, not silently hit the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
