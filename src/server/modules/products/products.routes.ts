import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission } from "@prisma/client";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import {
  findProductByDescription,
  findProductByGtin,
  findProductBySku,
  insertProduct,
  listProducts,
  updateProduct,
} from "./products.repository";
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productParamsSchema,
  productSchema,
  updateProductBodySchema,
} from "./products.schemas";

const DESCRIPTION_TAKEN = { message: "A product with this description already exists." };
const GTIN_TAKEN = { message: "A product with this GTIN already exists." };

// Whether another product than `sku` already holds this description or GTIN. With no `sku`, any does.
async function conflictOf(input: { description?: string; gtin?: string | null }, sku?: string) {
  // The database answers a uuid in lower case, whatever case the request wrote it in.
  const takenBy = (found: { sku: string } | null) => found !== null && found.sku !== sku?.toLowerCase();

  if (input.description !== undefined && takenBy(await findProductByDescription(input.description))) {
    return DESCRIPTION_TAKEN;
  }

  if (input.gtin !== undefined && input.gtin !== null && takenBy(await findProductByGtin(input.gtin))) {
    return GTIN_TAKEN;
  }

  return null;
}

export const productsRoutes: Route[] = [
  route({
    method: "GET",
    path: "/products",
    auth: Permission.CATALOG_READ,
    tags: ["products"],
    summary: "Lista os produtos, filtrados por busca, tipo, unidade e situação",
    querystring: listProductsQuerySchema,
    response: { 200: z.array(productSchema) },
    handler: async (request, reply) => reply.send(await listProducts(request.query)),
  }),

  route({
    method: "POST",
    path: "/products",
    auth: Permission.CATALOG_CREATE,
    tags: ["products"],
    summary: "Cadastra um produto",
    body: createProductBodySchema,
    response: { 201: productSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const conflict = await conflictOf(request.body);

      if (conflict !== null) return reply.code(409).send(conflict);

      return reply.code(201).send(await insertProduct(request.body));
    },
  }),

  route({
    method: "PATCH",
    path: "/products/:sku",
    auth: Permission.CATALOG_UPDATE,
    tags: ["products"],
    summary: "Edita a descrição, o GTIN e o estoque mínimo de um produto, ou o inativa e reativa",
    params: productParamsSchema,
    body: updateProductBodySchema,
    response: { 200: productSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const { sku } = request.params;

      if ((await findProductBySku(sku)) === null) {
        return reply.code(404).send({ message: "Product not found." });
      }

      const conflict = await conflictOf(request.body, sku);

      if (conflict !== null) return reply.code(409).send(conflict);

      return reply.send(await updateProduct(sku, request.body));
    },
  }),
];
