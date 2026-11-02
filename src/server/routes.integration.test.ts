import { describe, expect, it } from "vitest";
import { API_PREFIX } from "@/server/lib/api-version";
import { routes } from "@/server/routes";

// Every route and the rule it declares, in one readable list. Loosening a permission stops being a
// one-word change buried in a module and starts being a line in the diff of this snapshot.
describe("routes inventory", () => {
  it("matches the recorded access of every route", () => {
    const inventory = routes.map((route) => `${route.method} ${API_PREFIX}${route.path} -> ${route.auth}`).sort();

    expect(inventory.join("\n")).toMatchSnapshot();
  });

  it("gives each method and path to one route only", () => {
    const keys = routes.map((route) => `${route.method} ${route.path}`);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
