import type { Permission } from "@/features/auth/permission";

export interface PermissionExceptions {
  grantedPermissions: Permission[];
  deniedPermissions: Permission[];
}

export type PermissionOrigin = "role" | "granted" | "denied" | "none";

/**
 * The screen edits the result — what this person may do — and this turns it
 * into the pair the API stores. The API computes `(role ∪ granted) − denied`,
 * so `granted = desired − role` and `denied = role − desired` round-trip
 * exactly, and a grant the role already covers is dropped instead of stored.
 */
export function toExceptions(
  desired: readonly Permission[],
  rolePermissions: readonly Permission[],
): PermissionExceptions {
  const role = new Set(rolePermissions);
  const wanted = new Set(desired);

  return {
    grantedPermissions: [...wanted].filter((permission) => !role.has(permission)),
    deniedPermissions: [...role].filter((permission) => !wanted.has(permission)),
  };
}

/** Where a checkbox's state comes from, for the annotation beside each row. */
export function originOf(
  permission: Permission,
  desired: readonly Permission[],
  rolePermissions: readonly Permission[],
): PermissionOrigin {
  const inRole = rolePermissions.includes(permission);
  const isChecked = desired.includes(permission);

  if (isChecked) return inRole ? "role" : "granted";
  return inRole ? "denied" : "none";
}
