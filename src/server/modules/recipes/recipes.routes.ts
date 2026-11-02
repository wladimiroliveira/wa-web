import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission, ProductKind } from "@prisma/client";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { findProductsBySku, findRecipeByProductSku, findRecipeSummaries, saveRecipe } from "./recipes.repository";
import type { RecipeRecord, RecipeSummaryRecord } from "./recipes.repository";
import { recipeParamsSchema, recipeSchema, recipeSummarySchema, saveRecipeBodySchema } from "./recipes.schemas";

const toResponse = (recipe: RecipeRecord) => ({
  product: recipe.product,
  yieldQuantity: recipe.yieldQuantity.toString(),
  ingredients: recipe.ingredients.map(({ product, quantity }) => ({ product, quantity: quantity.toString() })),
  updatedAt: recipe.updatedAt.toISOString(),
});

const toSummary = (recipe: RecipeSummaryRecord) => ({
  product: recipe.product,
  yieldQuantity: recipe.yieldQuantity.toString(),
  ingredientCount: recipe._count.ingredients,
  updatedAt: recipe.updatedAt.toISOString(),
});

export const recipesRoutes: Route[] = [
  route({
    method: "GET",
    path: "/recipes",
    auth: Permission.CATALOG_READ,
    tags: ["recipes"],
    summary: "Lista um resumo de cada receita",
    response: { 200: z.array(recipeSummarySchema) },
    handler: async (_request, reply) => reply.send((await findRecipeSummaries()).map(toSummary)),
  }),

  route({
    method: "GET",
    path: "/products/:sku/recipe",
    auth: Permission.CATALOG_READ,
    tags: ["recipes"],
    summary: "Consulta a receita de um produto",
    params: recipeParamsSchema,
    response: { 200: recipeSchema, 404: messageSchema },
    handler: async (request, reply) => {
      const recipe = await findRecipeByProductSku(request.params.sku);

      if (recipe === null) {
        return reply.code(404).send({ message: "Recipe not found." });
      }

      return reply.send(toResponse(recipe));
    },
  }),

  route({
    method: "PUT",
    path: "/products/:sku/recipe",
    auth: Permission.CATALOG_UPDATE,
    tags: ["recipes"],
    summary: "Define ou substitui a receita de um produto fabricado",
    params: recipeParamsSchema,
    body: saveRecipeBodySchema,
    response: { 200: recipeSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const productSku = request.params.sku;
      const [product] = await findProductsBySku([productSku]);

      if (product === undefined) {
        return reply.code(404).send({ message: "Product not found." });
      }

      if (!product.isActive) {
        return reply.code(409).send({ message: "Product is inactive." });
      }

      if (product.kind !== ProductKind.MANUFACTURED) {
        return reply.code(409).send({ message: "Only a manufactured product has a recipe." });
      }

      const { ingredients } = request.body;
      const ingredientProducts = await findProductsBySku(ingredients.map((ingredient) => ingredient.productSku));

      if (ingredientProducts.length !== ingredients.length) {
        return reply.code(404).send({ message: "Ingredient product not found." });
      }

      if (ingredientProducts.some((ingredient) => !ingredient.isActive)) {
        return reply.code(409).send({ message: "Ingredient product is inactive." });
      }

      const recipe = await saveRecipe({ productSku, ...request.body });

      if (recipe === null) {
        return reply
          .code(409)
          .send({ message: "A product cannot be an ingredient of itself, directly or through another recipe." });
      }

      return reply.send(toResponse(recipe));
    },
  }),
];
