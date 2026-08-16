import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { renderWithProviders } from "@/tests/render";

function Harness({ initial, rolePermissions }: { initial: Permission[]; rolePermissions?: Permission[] }) {
  const [value, setValue] = useState<Permission[]>(initial);

  return (
    <>
      <PermissionPicker value={value} onChange={setValue} rolePermissions={rolePermissions} />
      <p data-testid="value">{[...value].sort().join(",")}</p>
    </>
  );
}

describe("PermissionPicker", () => {
  test("renders one checkbox per permission, grouped by module", () => {
    renderWithProviders(<Harness initial={[]} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(13);
    expect(screen.getByRole("checkbox", { name: "Insumos — Escrever" })).not.toBeChecked();
  });

  test("checking a permission adds it to the value", async () => {
    renderWithProviders(<Harness initial={[]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Ler" }));

    expect(screen.getByTestId("value")).toHaveTextContent("STOCK_READ");
  });

  test("unchecking removes it", async () => {
    renderWithProviders(<Harness initial={["STOCK_READ"]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Estoque — Ler" }));

    expect(screen.getByTestId("value")).toHaveTextContent("");
  });

  test("annotates where each check comes from when a role is given", () => {
    renderWithProviders(
      <Harness initial={["STOCK_READ", "SUPPLIES_WRITE"]} rolePermissions={["STOCK_READ", "STOCK_WRITE"]} />,
    );

    expect(screen.getByTestId("origin-STOCK_READ")).toHaveTextContent("do papel");
    expect(screen.getByTestId("origin-SUPPLIES_WRITE")).toHaveTextContent("+");
    expect(screen.getByTestId("origin-STOCK_WRITE")).toHaveTextContent("−");
    expect(screen.queryByTestId("origin-WASTE_READ")).not.toBeInTheDocument();
  });

  test("shows no annotation at all without a role", () => {
    renderWithProviders(<Harness initial={["STOCK_READ"]} />);

    expect(screen.queryByTestId("origin-STOCK_READ")).not.toBeInTheDocument();
  });
});
