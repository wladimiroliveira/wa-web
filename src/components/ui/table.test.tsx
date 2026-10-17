import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

describe("Table", () => {
  it("sits on its own bordered surface, apart from the rest of the page", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Farinha de trigo</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const container = screen.getByRole("table").parentElement!;
    expect(container).toHaveAttribute("data-slot", "table-container");
    expect(container).toHaveClass("rounded-xl", "border", "bg-card", "text-card-foreground", "overflow-x-auto");
  });

  it("keeps the edge cells off the border of its surface", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Farinha de trigo</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("cell")).toHaveClass("first:pl-4", "last:pr-4");
  });
});
