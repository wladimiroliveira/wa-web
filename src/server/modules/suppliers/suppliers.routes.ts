import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission } from "@prisma/client";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { findSupplierByName, insertSupplier, listSuppliers } from "./suppliers.repository";
import { createSupplierBodySchema, supplierSchema } from "./suppliers.schemas";

export const suppliersRoutes: Route[] = [
  route({
    method: "GET",
    path: "/suppliers",
    auth: Permission.CATALOG_READ,
    tags: ["suppliers"],
    summary: "Lista os fornecedores",
    response: { 200: z.array(supplierSchema) },
    handler: async (_request, reply) => reply.send(await listSuppliers()),
  }),

  route({
    method: "POST",
    path: "/suppliers",
    auth: Permission.CATALOG_CREATE,
    tags: ["suppliers"],
    summary: "Cadastra um fornecedor",
    body: createSupplierBodySchema,
    response: { 201: supplierSchema, 409: messageSchema },
    handler: async (request, reply) => {
      if ((await findSupplierByName(request.body.name)) !== null) {
        return reply.code(409).send({ message: "A supplier with this name already exists." });
      }

      return reply.code(201).send(await insertSupplier(request.body));
    },
  }),
];
