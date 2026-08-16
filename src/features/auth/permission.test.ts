import { describe, expect, test } from "vitest";
import { hasPermission, type Permission } from "@/features/auth/permission";

/**
 * `satisfies` makes tsc reject a misspelled name here, and `Missing` makes it
 * reject a permission the API adds and this list forgets. The runtime
 * assertion only guards the count.
 */
const ALL_PERMISSIONS = [
  "SUPPLIES_READ",
  "SUPPLIES_WRITE",
  "RECIPES_READ",
  "RECIPES_WRITE",
  "PRICING_READ",
  "STOCK_READ",
  "STOCK_WRITE",
  "PRODUCTION_READ",
  "PRODUCTION_WRITE",
  "WASTE_READ",
  "WASTE_WRITE",
  "USERS_READ",
  "USERS_WRITE",
] as const satisfies readonly Permission[];

type Missing = Exclude<Permission, (typeof ALL_PERMISSIONS)[number]>;
const everyPermissionIsListed: Missing extends never ? true : never = true;

describe("Permission", () => {
  test("the union covers exactly the API's 13 permissions", () => {
    expect(everyPermissionIsListed).toBe(true);
    expect(ALL_PERMISSIONS).toHaveLength(13);
  });
});

describe("hasPermission", () => {
  test("is true when the permission is granted", () => {
    expect(hasPermission(["SUPPLIES_READ", "RECIPES_READ"], "RECIPES_READ")).toBe(true);
  });

  test("is false when it is not", () => {
    expect(hasPermission(["SUPPLIES_READ"], "USERS_WRITE")).toBe(false);
  });

  test("is false for an empty permission set", () => {
    expect(hasPermission([], "SUPPLIES_READ")).toBe(false);
  });
});
