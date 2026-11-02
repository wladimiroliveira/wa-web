import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { AUTHENTICATED } from "@/server/modules/auth/auth.access";
import { deleteTableLayout, listTableLayouts, saveTableLayout } from "./table-layouts.repository";
import { tableKeyParamsSchema, tableLayoutBodySchema, tableLayoutSchema } from "./table-layouts.schemas";

// Each user arranges only their own tables, so every route reads and writes under the user signed in.
export const tableLayoutsRoutes: Route[] = [
  route({
    method: "GET",
    path: "/sessions/me/table-layouts",
    auth: AUTHENTICATED,
    tags: ["table-layouts"],
    summary: "Lista a disposição das colunas que o usuário deu às tabelas",
    response: { 200: z.array(tableLayoutSchema) },
    handler: async (request, reply) => reply.send(await listTableLayouts(request.currentUser!.id)),
  }),

  route({
    method: "PUT",
    path: "/sessions/me/table-layouts/:tableKey",
    auth: AUTHENTICATED,
    tags: ["table-layouts"],
    summary: "Grava a ordem e a largura das colunas de uma tabela",
    params: tableKeyParamsSchema,
    body: tableLayoutBodySchema,
    response: { 200: tableLayoutSchema },
    handler: async (request, reply) =>
      reply.send(await saveTableLayout(request.currentUser!.id, request.params.tableKey, request.body)),
  }),

  route({
    method: "DELETE",
    path: "/sessions/me/table-layouts/:tableKey",
    auth: AUTHENTICATED,
    tags: ["table-layouts"],
    summary: "Devolve uma tabela à disposição original das colunas",
    params: tableKeyParamsSchema,
    response: { 204: z.void() },
    handler: async (request, reply) => {
      await deleteTableLayout(request.currentUser!.id, request.params.tableKey);

      return reply.code(204).send();
    },
  }),
];
