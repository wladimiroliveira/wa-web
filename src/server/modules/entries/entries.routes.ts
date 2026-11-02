import { route, type Route } from "@/server/http/route";
import { Permission } from "@prisma/client";
import { toOptionalDateString } from "@/server/lib/dates";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { findSupplierById } from "@/server/modules/suppliers/suppliers.repository";
import { findProductBySku, insertEntry, NegativeBalancePendingError } from "./entries.repository";
import { createEntryBodySchema, entryConflictSchema, entrySchema } from "./entries.schemas";

export const entriesRoutes: Route[] = [
  route({
    method: "POST",
    path: "/entries",
    auth: Permission.ENTRIES_CREATE,
    tags: ["entries"],
    summary: "Lança a entrada de um produto e soma ao estoque",
    body: createEntryBodySchema,
    response: { 201: entrySchema, 404: messageSchema, 409: entryConflictSchema },
    handler: async (request, reply) => {
      const product = await findProductBySku(request.body.productSku);

      if (product === null) {
        return reply.code(404).send({ message: "Product not found." });
      }

      if (!product.isActive) {
        return reply.code(409).send({ message: "Product is inactive." });
      }

      const { supplierId } = request.body;

      if (supplierId !== undefined && (await findSupplierById(supplierId)) === null) {
        return reply.code(404).send({ message: "Supplier not found." });
      }

      const recorded = await insertEntry({ ...request.body, createdById: request.currentUser!.id }).catch(
        (error: unknown) => {
          if (error instanceof NegativeBalancePendingError) return error;

          throw error;
        },
      );

      if (recorded instanceof NegativeBalancePendingError) {
        return reply.code(409).send({ message: recorded.message, deficit: recorded.deficit.toString() });
      }

      const { movement, lot, stock } = recorded;

      return reply.code(201).send({
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity.toString(),
        unitCost: movement.unitCost.toString(),
        createdAt: movement.createdAt.toISOString(),
        product: { sku: product.sku, description: product.description, unit: product.unit },
        lot: {
          id: lot.id,
          expiresAt: toOptionalDateString(lot.expiresAt),
          supplier: lot.supplier,
          quantity: lot.quantity.toString(),
        },
        stock: {
          quantity: stock!.quantity.toString(),
          lastEntryCost: stock!.lastEntryCost.toString(),
          averageCost: stock!.averageCost.toString(),
        },
      });
    },
  }),
];
