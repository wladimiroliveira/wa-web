import { describe, expect, test } from "vitest";
import type { Permission } from "@/features/auth/permission";
import { originOf, toExceptions } from "@/features/auth/permission-diff";

/** Mirrors the API rule: effective = (role ∪ granted) − denied. Denial always wins. */
function effectivePermissions(role: Permission[], granted: Permission[], denied: Permission[]): Permission[] {
  const effective = new Set<Permission>([...role, ...granted]);
  for (const permission of denied) effective.delete(permission);
  return [...effective].sort();
}

const ESTOQUISTA: Permission[] = ["STOCK_READ", "STOCK_WRITE", "SUPPLIES_READ"];

describe("toExceptions", () => {
  test("round-trips: what the API computes from the exceptions is what the screen had checked", () => {
    const desired: Permission[] = ["STOCK_READ", "SUPPLIES_READ", "SUPPLIES_WRITE"];

    const { grantedPermissions, deniedPermissions } = toExceptions(desired, ESTOQUISTA);

    expect(effectivePermissions(ESTOQUISTA, grantedPermissions, deniedPermissions)).toEqual([...desired].sort());
  });

  test("round-trips with no role at all", () => {
    const desired: Permission[] = ["USERS_READ", "USERS_WRITE"];

    const { grantedPermissions, deniedPermissions } = toExceptions(desired, []);

    expect(grantedPermissions.sort()).toEqual([...desired].sort());
    expect(deniedPermissions).toEqual([]);
    expect(effectivePermissions([], grantedPermissions, deniedPermissions)).toEqual([...desired].sort());
  });

  test("round-trips when nothing is checked: the whole role is denied", () => {
    const { grantedPermissions, deniedPermissions } = toExceptions([], ESTOQUISTA);

    expect(grantedPermissions).toEqual([]);
    expect([...deniedPermissions].sort()).toEqual([...ESTOQUISTA].sort());
    expect(effectivePermissions(ESTOQUISTA, grantedPermissions, deniedPermissions)).toEqual([]);
  });

  test("drops a redundant grant: what the role already gives is not an exception", () => {
    const { grantedPermissions } = toExceptions(ESTOQUISTA, ESTOQUISTA);

    expect(grantedPermissions).toEqual([]);
  });
});

describe("originOf", () => {
  test("classifies each permission by where the check came from", () => {
    const desired: Permission[] = ["STOCK_READ", "SUPPLIES_WRITE"];

    expect(originOf("STOCK_READ", desired, ESTOQUISTA)).toBe("role");
    expect(originOf("SUPPLIES_WRITE", desired, ESTOQUISTA)).toBe("granted");
    expect(originOf("STOCK_WRITE", desired, ESTOQUISTA)).toBe("denied");
    expect(originOf("WASTE_READ", desired, ESTOQUISTA)).toBe("none");
  });
});
