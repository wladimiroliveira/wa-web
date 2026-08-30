import type { Permission } from "@/lib/api";

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

/**
 * The single source of the menu. Each slice adds its own destination here when
 * its screen lands; a path listed here must resolve to a real route.
 */
export const NAV_ITEMS: readonly NavItem[] = [{ to: "/roles", label: "Papéis", permission: "ACCESS_READ" }];
