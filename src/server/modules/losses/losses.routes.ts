import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission } from "@prisma/client";
import { toOptionalDateString } from "@/server/lib/dates";
import { AUTHENTICATED } from "@/server/modules/auth/auth.access";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import {
  findLossReasonById,
  findLossReasonByName,
  insertLoss,
  insertLossReason,
  listLossReasons,
  updateLossReason,
} from "./losses.repository";
import {
  createLossBodySchema,
  createLossReasonBodySchema,
  lossReasonIdParamsSchema,
  lossReasonSchema,
  lossSchema,
  updateLossReasonBodySchema,
} from "./losses.schemas";

const LOSS_FAILURES = {
  missing: { code: 404, message: "Lot not found." },
  insufficient: { code: 409, message: "The lot does not hold that much." },
  "reason-missing": { code: 404, message: "Loss reason not found." },
  "reason-inactive": { code: 409, message: "Loss reason is inactive." },
} as const;

export const lossesRoutes: Route[] = [
  route({
    method: "GET",
    path: "/loss-reasons",
    auth: AUTHENTICATED,
    tags: ["losses"],
    summary: "Lista as modalidades de avaria",
    response: { 200: z.array(lossReasonSchema) },
    handler: async (_request, reply) => reply.send(await listLossReasons()),
  }),

  route({
    method: "POST",
    path: "/loss-reasons",
    auth: Permission.LOSSES_UPDATE,
    tags: ["losses"],
    summary: "Cadastra uma modalidade de avaria",
    body: createLossReasonBodySchema,
    response: { 201: lossReasonSchema, 409: messageSchema },
    handler: async (request, reply) => {
      if ((await findLossReasonByName(request.body.name)) !== null) {
        return reply.code(409).send({ message: "A loss reason with this name already exists." });
      }

      return reply.code(201).send(await insertLossReason(request.body));
    },
  }),

  route({
    method: "PATCH",
    path: "/loss-reasons/:id",
    auth: Permission.LOSSES_UPDATE,
    tags: ["losses"],
    summary: "Edita, inativa ou reativa uma modalidade de avaria",
    params: lossReasonIdParamsSchema,
    body: updateLossReasonBodySchema,
    response: { 200: lossReasonSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const { id } = request.params;

      if ((await findLossReasonById(id)) === null) {
        return reply.code(404).send({ message: "Loss reason not found." });
      }

      if (request.body.name !== undefined) {
        const sameName = await findLossReasonByName(request.body.name);

        if (sameName !== null && sameName.id !== id) {
          return reply.code(409).send({ message: "A loss reason with this name already exists." });
        }
      }

      return reply.send(await updateLossReason(id, request.body));
    },
  }),

  route({
    method: "POST",
    path: "/losses",
    auth: Permission.LOSSES_CREATE,
    tags: ["losses"],
    summary: "Registra a avaria de parte de um lote e baixa do estoque",
    body: createLossBodySchema,
    response: { 201: lossSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const recorded = await insertLoss({ ...request.body, createdById: request.currentUser!.id });

      if ("failure" in recorded) {
        const { code, message } = LOSS_FAILURES[recorded.failure];

        return reply.code(code).send({ message });
      }

      const { loss, lot } = recorded;

      return reply.code(201).send({
        id: loss.id,
        quantity: loss.movement.quantity.toString(),
        unitCost: lot.unitCost.toString(),
        note: loss.note,
        createdAt: loss.createdAt.toISOString(),
        reason: loss.reason,
        product: loss.lot.product,
        lot: {
          id: lot.id,
          expiresAt: toOptionalDateString(lot.expiresAt),
          quantity: lot.left.toString(),
        },
      });
    },
  }),
];
