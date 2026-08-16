import type { Permission } from "@/features/auth/permission";

export interface PermissionLabel {
  group: string;
  action: string;
}

export interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

/**
 * Exhaustive on purpose. When the API adds a permission, `Record` makes tsc
 * fail here until someone writes the Portuguese label — a new contract never
 * reaches the screen unnoticed.
 */
export const PERMISSION_LABELS: Record<Permission, PermissionLabel> = {
  SUPPLIES_READ: { group: "Insumos", action: "Ler" },
  SUPPLIES_WRITE: { group: "Insumos", action: "Escrever" },
  RECIPES_READ: { group: "Receitas", action: "Ler" },
  RECIPES_WRITE: { group: "Receitas", action: "Escrever" },
  PRICING_READ: { group: "Precificação", action: "Ler" },
  STOCK_READ: { group: "Estoque", action: "Ler" },
  STOCK_WRITE: { group: "Estoque", action: "Escrever" },
  PRODUCTION_READ: { group: "Produção", action: "Ler" },
  PRODUCTION_WRITE: { group: "Produção", action: "Escrever" },
  WASTE_READ: { group: "Perdas", action: "Ler" },
  WASTE_WRITE: { group: "Perdas", action: "Escrever" },
  USERS_READ: { group: "Usuários", action: "Ler" },
  USERS_WRITE: { group: "Usuários", action: "Escrever" },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

/** Derived from the record, so a permission cannot exist in one and be missing from the other. */
export const PERMISSION_GROUPS: PermissionGroup[] = ALL_PERMISSIONS.reduce<PermissionGroup[]>((groups, permission) => {
  const { group } = PERMISSION_LABELS[permission];
  const existing = groups.find((candidate) => candidate.group === group);

  if (existing) existing.permissions.push(permission);
  else groups.push({ group, permissions: [permission] });

  return groups;
}, []);
