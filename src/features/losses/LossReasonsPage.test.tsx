import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LossReasonsPage } from "@/features/losses/LossReasonsPage";
import type { LossReason } from "@/lib/api";
import { apiUrl, server } from "@/tests/msw-server";
import { renderWithProviders } from "@/tests/render";
import { arrangedTable, columnHeaders } from "@/tests/table-layouts";
import { chooseRowAction } from "@/tests/row-actions";
import { aLossReason } from "@/tests/samples";

/** A list that answers what it was last told, so a save shows up on the refetch that follows it. */
function reasonsServer(initial: LossReason[]) {
  let reasons = initial;
  const received: { method: string; path: string; body: unknown }[] = [];

  server.use(
    http.get(apiUrl("/loss-reasons"), () => HttpResponse.json(reasons)),
    http.post(apiUrl("/loss-reasons"), async ({ request: incoming }) => {
      const body = (await incoming.json()) as { name: string; description?: string };
      received.push({ method: "POST", path: "/loss-reasons", body });
      const created = aLossReason({ id: "reason-new", name: body.name, description: body.description ?? null });
      reasons = [...reasons, created];

      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(apiUrl("/loss-reasons/:id"), async ({ request: incoming, params }) => {
      const body = (await incoming.json()) as Partial<LossReason>;
      received.push({ method: "PATCH", path: `/loss-reasons/${String(params.id)}`, body });
      reasons = reasons.map((reason) => (reason.id === params.id ? { ...reason, ...body } : reason));

      return HttpResponse.json(reasons.find((reason) => reason.id === params.id));
    }),
  );

  return received;
}

const rowOf = (name: string) => within(screen.getByRole("cell", { name }).closest("tr")!);

describe("LossReasonsPage", () => {
  it("lists each reason with its description and whether it is in use", async () => {
    reasonsServer([
      aLossReason({ id: "reason-1", name: "Vencimento", description: "Passou da validade." }),
      aLossReason({ id: "reason-2", name: "Quebra", description: null, isActive: false }),
    ]);

    renderWithProviders(<LossReasonsPage />);

    await screen.findByRole("cell", { name: "Vencimento" });
    expect(rowOf("Vencimento").getByText("Passou da validade.")).toBeInTheDocument();
    expect(rowOf("Vencimento").getByText("Ativa")).toBeInTheDocument();
    expect(rowOf("Quebra").getByText("—")).toBeInTheDocument();
    expect(rowOf("Quebra").getByText("Inativa")).toBeInTheDocument();
  });

  it("offers the registration as an icon button in the row of the count", async () => {
    reasonsServer([aLossReason()]);

    renderWithProviders(<LossReasonsPage />);

    const create = await screen.findByRole("button", { name: "Nova modalidade" });
    expect(create).toHaveTextContent("");
    expect(create.closest("div")).toContainElement(screen.getByText("1 modalidade"));
  });

  it("still offers the registration when the list is empty", async () => {
    reasonsServer([]);

    renderWithProviders(<LossReasonsPage />);

    await screen.findByText("Nenhuma modalidade cadastrada ainda.");
    expect(screen.getByRole("button", { name: "Nova modalidade" })).toBeInTheDocument();
  });

  it("says there are no reasons instead of showing a bare table", async () => {
    reasonsServer([]);

    renderWithProviders(<LossReasonsPage />);

    expect(await screen.findByText("Nenhuma modalidade cadastrada ainda.")).toBeInTheDocument();
  });

  it("offers a way out when the list fails to load", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl("/loss-reasons"), () => {
        attempts += 1;
        return attempts === 1 ? new HttpResponse(null, { status: 502 }) : HttpResponse.json([aLossReason()]);
      }),
    );

    renderWithProviders(<LossReasonsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("cell", { name: "Vencimento" })).toBeInTheDocument();
  });

  it("registers a reason with its description and shows it in the list", async () => {
    const received = reasonsServer([]);

    renderWithProviders(<LossReasonsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova modalidade" }));
    await userEvent.type(await screen.findByLabelText("Nome"), "Vencimento");
    await userEvent.type(screen.getByLabelText("Descrição (opcional)"), "Passou da validade.");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("cell", { name: "Vencimento" })).toBeInTheDocument();
    expect(received).toEqual([
      { method: "POST", path: "/loss-reasons", body: { name: "Vencimento", description: "Passou da validade." } },
    ]);
  });

  it("refuses a reason with no name", async () => {
    reasonsServer([]);

    renderWithProviders(<LossReasonsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova modalidade" }));
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe o nome da modalidade.")).toBeInTheDocument();
  });

  it("opens a reason already filled to edit it, and sends the change", async () => {
    const received = reasonsServer([aLossReason({ id: "reason-1", name: "Vencimento", description: "Antiga." })]);

    renderWithProviders(<LossReasonsPage />);

    await chooseRowAction("Ações de Vencimento", "Editar");

    const name = await screen.findByLabelText("Nome", { selector: "input" });
    expect(name).toHaveValue("Vencimento");
    expect(screen.getByLabelText("Descrição (opcional)")).toHaveValue("Antiga.");

    await userEvent.clear(name);
    await userEvent.type(name, "Vencido");
    await userEvent.clear(screen.getByLabelText("Descrição (opcional)"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("cell", { name: "Vencido" })).toBeInTheDocument();
    expect(received).toEqual([
      { method: "PATCH", path: "/loss-reasons/reason-1", body: { name: "Vencido", description: null } },
    ]);
  });

  it("says the name is taken, in Portuguese, and keeps the dialog open", async () => {
    server.use(
      http.get(apiUrl("/loss-reasons"), () => HttpResponse.json([])),
      http.post(apiUrl("/loss-reasons"), () => HttpResponse.json({ message: "Taken." }, { status: 409 })),
    );

    renderWithProviders(<LossReasonsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova modalidade" }));
    await userEvent.type(await screen.findByLabelText("Nome"), "Vencimento");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma modalidade com esse nome.");
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("deactivates a reason in use and reactivates one that is not", async () => {
    const received = reasonsServer([aLossReason({ id: "reason-1", name: "Vencimento" })]);

    renderWithProviders(<LossReasonsPage />);

    await chooseRowAction("Ações de Vencimento", "Inativar");
    expect(await screen.findByText("Inativa")).toBeInTheDocument();

    await chooseRowAction("Ações de Vencimento", "Reativar");
    await waitFor(() => expect(screen.getByText("Ativa")).toBeInTheDocument());

    expect(received.map(({ body }) => body)).toEqual([{ isActive: false }, { isActive: true }]);
  });
});

describe("LossReasonsPage layout", () => {
  it("gives the table the height left on the screen", async () => {
    reasonsServer([aLossReason({ name: "Vencimento" })]);

    renderWithProviders(<LossReasonsPage />);

    await screen.findByRole("cell", { name: "Vencimento" });
    expect(screen.getByRole("table").parentElement).toHaveAttribute("data-fill", "true");
  });
});

describe("LossReasonsPage columns", () => {
  it("shows the columns in the order the user arranged them", async () => {
    arrangedTable("loss-reasons", { order: ["description", "name"] });
    reasonsServer([aLossReason()]);

    renderWithProviders(<LossReasonsPage />);

    await waitFor(() => expect(columnHeaders()[0]).toBe("Descrição"));
  });
});
