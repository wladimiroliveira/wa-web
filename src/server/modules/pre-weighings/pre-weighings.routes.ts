import { route, type Route } from "@/server/http/route";
import { Permission } from "@prisma/client";
import { localToday, toOptionalDateString } from "@/server/lib/dates";
import { toPage } from "@/server/lib/pagination";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { suggestLots } from "@/server/modules/stock/stock.repository";
import { findPreWeighingById, insertPreWeighing, listPreWeighings } from "./pre-weighings.repository";
import type { PreWeighingRecord } from "./pre-weighings.repository";
import {
  createPreWeighingBodySchema,
  listPreWeighingsQuerySchema,
  preWeighingIdParamsSchema,
  preWeighingPageSchema,
  preWeighingPlanQuerySchema,
  preWeighingPlanSchema,
  preWeighingSchema,
} from "./pre-weighings.schemas";
import { planPreWeighing } from "./pre-weighings.service";

const toResponse = (preWeighing: PreWeighingRecord) => ({
  id: preWeighing.id,
  product: preWeighing.product,
  quantity: preWeighing.quantity.toString(),
  createdAt: preWeighing.createdAt.toISOString(),
  items: preWeighing.items.map(({ product, plannedQuantity, weighedQuantity }) => ({
    product,
    plannedQuantity: plannedQuantity.toString(),
    weighedQuantity: weighedQuantity.toString(),
  })),
});

export const preWeighingsRoutes: Route[] = [
  route({
    method: "GET",
    path: "/pre-weighings/plan",
    auth: Permission.PRODUCTION_READ,
    tags: ["pre-weighings"],
    summary: "Calcula quanto pesar de cada ingrediente para produzir uma quantidade",
    querystring: preWeighingPlanQuerySchema,
    response: { 200: preWeighingPlanSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const result = await planPreWeighing(request.query.productSku, request.query.quantity);

      if ("failure" in result) {
        return reply.code(result.failure.code).send({ message: result.failure.message });
      }

      const today = localToday();
      const items = await Promise.all(
        result.plan.items.map(async ({ product, plannedQuantity }) => {
          const { takes, shortfall } = await suggestLots({ productSku: product.sku, quantity: plannedQuantity, today });

          return {
            product,
            plannedQuantity: plannedQuantity.toString(),
            lots: takes.map(({ lot, quantity }) => ({
              id: lot.id,
              expiresAt: toOptionalDateString(lot.expiresAt),
              quantity: quantity.toString(),
            })),
            shortfall: shortfall.toString(),
          };
        }),
      );

      return reply.send({ product: result.plan.product, quantity: result.plan.quantity.toString(), items });
    },
  }),

  route({
    method: "POST",
    path: "/pre-weighings",
    auth: Permission.PRODUCTION_CREATE,
    tags: ["pre-weighings"],
    summary: "Registra a pré-pesagem dos ingredientes de um produto",
    body: createPreWeighingBodySchema,
    response: { 201: preWeighingSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const { productSku, quantity, items } = request.body;
      const result = await planPreWeighing(productSku, quantity);

      if ("failure" in result) {
        return reply.code(result.failure.code).send({ message: result.failure.message });
      }

      const weighedBySku = new Map(items.map((item) => [item.productSku.toLowerCase(), item.weighedQuantity]));
      const planned = result.plan.items;

      if (planned.length !== weighedBySku.size || planned.some(({ product }) => !weighedBySku.has(product.sku))) {
        return reply.code(409).send({ message: "The items do not match the ingredients of the recipe." });
      }

      const preWeighing = await insertPreWeighing({
        productSku,
        quantity,
        createdById: request.currentUser!.id,
        items: planned.map(({ product, plannedQuantity }) => ({
          productSku: product.sku,
          plannedQuantity,
          weighedQuantity: weighedBySku.get(product.sku)!,
        })),
      });

      return reply.code(201).send(toResponse(preWeighing));
    },
  }),

  route({
    method: "GET",
    path: "/pre-weighings",
    auth: Permission.PRODUCTION_READ,
    tags: ["pre-weighings"],
    summary: "Lista as pré-pesagens, das mais recentes para as mais antigas",
    querystring: listPreWeighingsQuerySchema,
    response: { 200: preWeighingPageSchema },
    handler: async (request, reply) => {
      const { items, nextCursor } = toPage(await listPreWeighings(request.query), request.query);

      return reply.send({ items: items.map(toResponse), nextCursor });
    },
  }),

  route({
    method: "GET",
    path: "/pre-weighings/:id",
    auth: Permission.PRODUCTION_READ,
    tags: ["pre-weighings"],
    summary: "Consulta uma pré-pesagem registrada",
    params: preWeighingIdParamsSchema,
    response: { 200: preWeighingSchema, 404: messageSchema },
    handler: async (request, reply) => {
      const preWeighing = await findPreWeighingById(request.params.id);

      if (preWeighing === null) {
        return reply.code(404).send({ message: "Pre-weighing not found." });
      }

      return reply.send(toResponse(preWeighing));
    },
  }),
];
