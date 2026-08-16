import { describe, expect, test } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/features/auth/permission-labels";

describe("permission labels", () => {
  test("every permission in the record appears exactly once across the groups", () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);

    expect([...grouped].sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  test("groups keep the record order, so the screen reads module by module", () => {
    expect(PERMISSION_GROUPS.map((group) => group.group)).toEqual([
      "Insumos",
      "Receitas",
      "Precificação",
      "Estoque",
      "Produção",
      "Perdas",
      "Usuários",
    ]);
  });

  test("each permission carries a group and an action in Portuguese", () => {
    expect(PERMISSION_LABELS.SUPPLIES_WRITE).toEqual({
      group: "Insumos",
      action: "Escrever",
    });
    expect(PERMISSION_LABELS.PRICING_READ).toEqual({
      group: "Precificação",
      action: "Ler",
    });
  });
});
