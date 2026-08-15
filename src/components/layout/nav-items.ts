import type { Permission } from "@/features/auth/permission";

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

/** The single source of the menu. A screen that is not listed here has no way in. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/supplies", label: "Insumos", permission: "SUPPLIES_READ" },
  { to: "/recipes", label: "Receitas", permission: "RECIPES_READ" },
  { to: "/stock", label: "Estoque", permission: "STOCK_READ" },
  { to: "/productions", label: "Produções", permission: "PRODUCTION_READ" },
  { to: "/wastes", label: "Perdas", permission: "WASTE_READ" },
  { to: "/users", label: "Usuários", permission: "USERS_READ" },
];
