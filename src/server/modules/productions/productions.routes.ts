import { route, type Route } from "@/server/http/route";
import { Permission } from "@prisma/client";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { toPage } from "@/server/lib/pagination";
import { findProductionById, listProductions } from "./productions.repository";
import type { ProductionRecord } from "./productions.repository";
import {
  finishProductionBodySchema,
  listProductionsQuerySchema,
  productionIdParamsSchema,
  productionPageSchema,
  productionSchema,
  startProductionBodySchema,
} from "./productions.schemas";
import { cancelProduction, finishProduction, startProduction } from "./productions.service";

const toResponse = (production: ProductionRecord) => ({
  id: production.id,
  status: production.status,
  createdAt: production.createdAt.toISOString(),
  finishedAt: production.finishedAt?.toISOString() ?? null,
  canceledAt: production.canceledAt?.toISOString() ?? null,
  items: production.items.map((item) => ({
    id: item.id,
    product: item.product,
    preWeighingId: item.preWeighingId,
    expectedQuantity: item.expectedQuantity.toString(),
    producedQuantity: item.producedQuantity?.toString() ?? null,
    unitCost: item.unitCost?.toString() ?? null,
    inputs: item.inputs.map(({ product, quantity, unitCost }) => ({
      product,
      quantity: quantity.toString(),
      unitCost: unitCost?.toString() ?? null,
    })),
  })),
});

export const productionsRoutes: Route[] = [
  route({
    method: "POST",
    path: "/productions",
    auth: Permission.PRODUCTION_CREATE,
    tags: ["productions"],
    summary: "Inicia uma produção, guiada por pré-pesagens ou livre pelas receitas",
    body: startProductionBodySchema,
    response: { 201: productionSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const result = await startProduction({ createdById: request.currentUser!.id, items: request.body.items });

      if ("failure" in result) {
        return reply.code(result.failure.code).send({ message: result.failure.message });
      }

      return reply.code(201).send(toResponse(result.production));
    },
  }),

  route({
    method: "GET",
    path: "/productions",
    auth: Permission.PRODUCTION_READ,
    tags: ["productions"],
    summary: "Lista as produções, das mais recentes para as mais antigas",
    querystring: listProductionsQuerySchema,
    response: { 200: productionPageSchema },
    handler: async (request, reply) => {
      const { items, nextCursor } = toPage(await listProductions(request.query), request.query);

      return reply.send({ items: items.map(toResponse), nextCursor });
    },
  }),

  route({
    method: "GET",
    path: "/productions/:id",
    auth: Permission.PRODUCTION_READ,
    tags: ["productions"],
    summary: "Consulta uma produção e o que ela usa de cada insumo",
    params: productionIdParamsSchema,
    response: { 200: productionSchema, 404: messageSchema },
    handler: async (request, reply) => {
      const production = await findProductionById(request.params.id);

      if (production === null) {
        return reply.code(404).send({ message: "Production not found." });
      }

      return reply.send(toResponse(production));
    },
  }),

  route({
    method: "POST",
    path: "/productions/:id/finish",
    auth: Permission.PRODUCTION_CREATE,
    tags: ["productions"],
    summary: "Finaliza uma produção: baixa os insumos e dá entrada no que foi produzido",
    params: productionIdParamsSchema,
    body: finishProductionBodySchema,
    response: { 200: productionSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const result = await finishProduction({
        id: request.params.id,
        createdById: request.currentUser!.id,
        items: request.body.items,
      });

      if ("failure" in result) {
        return reply.code(result.failure.code).send({ message: result.failure.message });
      }

      return reply.send(toResponse(result.production));
    },
  }),

  route({
    method: "POST",
    path: "/productions/:id/cancel",
    auth: Permission.PRODUCTION_CREATE,
    tags: ["productions"],
    summary: "Cancela uma produção em andamento e libera as pré-pesagens que a guiavam",
    params: productionIdParamsSchema,
    response: { 200: productionSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const result = await cancelProduction(request.params.id);

      if ("failure" in result) {
        return reply.code(result.failure.code).send({ message: result.failure.message });
      }

      return reply.send(toResponse(result.production));
    },
  }),
];
