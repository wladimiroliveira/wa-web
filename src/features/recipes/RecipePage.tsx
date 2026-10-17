import { useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { RecipeForm, recipeTitle } from "@/features/recipes/RecipeForm";
import { fetchRecipe, recipesKeys } from "@/features/recipes/recipes.api";
import { unitLabel } from "@/lib/units";
import { PageTitle } from "@/components/layout/PageTitle";

export function RecipePage() {
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts });
  const [productSku, setProductSku] = useState("");

  const recipe = useQuery({
    queryKey: recipesKeys.detail(productSku),
    queryFn: productSku === "" ? skipToken : () => fetchRecipe(productSku),
    // What is on the screen is being edited: a recipe is read anew each time its product is chosen,
    // and never refetched behind the operator, which would throw away the rows they are typing into.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
  });

  // Only a manufactured product has a recipe, and an inactive one is refused by the API.
  const offered = products.data?.filter((product) => product.isActive && product.kind === "MANUFACTURED") ?? [];
  const product = offered.find(({ sku }) => sku === productSku);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Receitas</PageTitle>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && offered.length === 0 ? <p>Nenhum produto fabricado ativo cadastrado.</p> : null}

      {products.isSuccess && offered.length > 0 ? (
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="recipe-product">Produto</Label>
          <NativeSelect id="recipe-product" value={productSku} onChange={(event) => setProductSku(event.target.value)}>
            <option value="">Selecione um produto</option>
            {offered.map(({ sku, description, unit }) => (
              <option key={sku} value={sku}>
                {description} ({unitLabel(unit)})
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {recipe.isLoading ? <p>Carregando a receita…</p> : null}

      {recipe.isError ? <QueryErrorState error={recipe.error} onRetry={() => void recipe.refetch()} /> : null}

      {product !== undefined && recipe.isSuccess ? (
        <>
          <h2 className="text-lg font-semibold">{recipeTitle(product, recipe.data)}</h2>
          {/* A saved recipe comes back with a new `updatedAt`, which starts the form over from it. */}
          <RecipeForm
            key={`${product.sku}:${recipe.data?.updatedAt ?? "new"}`}
            product={product}
            recipe={recipe.data}
            catalog={products.data ?? []}
          />
        </>
      ) : null}
    </div>
  );
}
