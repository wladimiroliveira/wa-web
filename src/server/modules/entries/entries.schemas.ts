import { z } from "zod";
import { StockMovementType } from "@prisma/client";
import { decimalSchema, positiveDecimalSchema } from "@/server/lib/decimal";
import { productSummarySchema } from "@/server/modules/products/products.schemas";
import { lotExpirySchema } from "@/server/modules/stock/stock.schemas";
import { supplierSchema } from "@/server/modules/suppliers/suppliers.schemas";

// How an entry settles a balance that went negative: bring it to zero first, so the whole entry is
// in stock, or let the entry pay what is owed and keep only what is left.
export const DeficitSettlement = { ZERO: "ZERO", DISCOUNT: "DISCOUNT" } as const;

export type DeficitSettlement = (typeof DeficitSettlement)[keyof typeof DeficitSettlement];

export const createEntryBodySchema = z.object({
  productSku: z.uuid(),
  quantity: positiveDecimalSchema,
  unitCost: decimalSchema,
  expiresAt: lotExpirySchema,
  supplierId: z.uuid().optional(),
  deficit: z.enum(DeficitSettlement).optional(),
});

export const entrySchema = z.object({
  id: z.uuid(),
  type: z.enum(StockMovementType),
  quantity: z.string(),
  unitCost: z.string(),
  createdAt: z.iso.datetime(),
  product: productSummarySchema,
  lot: z.object({
    id: z.uuid(),
    expiresAt: z.iso.date().nullable(),
    supplier: supplierSchema.nullable(),
    quantity: z.string(),
  }),
  stock: z.object({ quantity: z.string(), lastEntryCost: z.string(), averageCost: z.string() }),
});

// A 409 that carries `deficit` is the negative balance waiting for the entry to say how to settle it.
export const entryConflictSchema = z.object({ message: z.string(), deficit: z.string().optional() });
