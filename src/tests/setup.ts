import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// jsdom 30 ships no `matchMedia` at all, and sonner's <Toaster/> asks
// next-themes for the OS color scheme on mount — so any test that mounts one
// needs this stand-in. It is an environment polyfill, not test scaffolding,
// so it lives here once instead of being copied into every test file that
// renders a <Toaster/>.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
