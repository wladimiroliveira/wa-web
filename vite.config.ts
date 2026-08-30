import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    // The suite's API base url lives here, not in a `.env.test` file: an env file is
    // git-ignored, so a fresh clone or a CI runner would have no value to load and every
    // test would fail at import time inside `src/lib/env.ts`. Declaring it in tracked
    // config makes the suite self-sufficient.
    env: { VITE_API_BASE_URL: "http://api.test/v1" },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
  },
});
