import type { Permission } from "@/features/auth/permission";

export interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

/**
 * The single source of the menu. It no longer doubles as the route table —
 * `/users/new`, `/users/:id`, `/roles/new` and `/roles/:id` are reachable and
 * listed nowhere here — so the guarantee this list still gives is narrower:
 * every path below resolves to a real route, which is what
 * `router.test.tsx`'s "every NAV_ITEMS path resolves to a route" test checks.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/supplies", label: "Insumos", permission: "SUPPLIES_READ" },
  { to: "/recipes", label: "Receitas", permission: "RECIPES_READ" },
  { to: "/stock", label: "Estoque", permission: "STOCK_READ" },
  { to: "/productions", label: "Produções", permission: "PRODUCTION_READ" },
  { to: "/wastes", label: "Perdas", permission: "WASTE_READ" },
  { to: "/users", label: "Usuários", permission: "USERS_READ" },
  { to: "/roles", label: "Papéis", permission: "USERS_READ" },
];
