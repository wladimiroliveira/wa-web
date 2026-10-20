import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import { apiUrl, server } from "@/tests/msw-server";

/** A user who arranged the columns of one table, and no other. */
export function arrangedTable(tableKey: string, layout: { order?: string[]; widths?: Record<string, number> }): void {
  server.use(
    http.get(apiUrl("/sessions/me/table-layouts"), () =>
      HttpResponse.json([{ tableKey, order: layout.order ?? [], widths: layout.widths ?? {} }]),
    ),
  );
}

/** The headers of the table on screen, as the user reads them. */
export const columnHeaders = () => screen.getAllByRole("columnheader").map((header) => header.textContent);
