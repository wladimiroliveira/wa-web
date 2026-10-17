import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { RecipeForm, recipeTitle } from "@/features/recipes/RecipeForm";
import type { Product } from "@/lib/api";

interface RecipeDialogProps {
  /** The product to write the first recipe of, or `null` while there is none to ask about. */
  product: Product | null;
  onClose: () => void;
}

/** Starts the recipe of a product that has none, right where the product came to exist. */
export function RecipeDialog({ product, onClose }: RecipeDialogProps) {
  // Mounted with every product list, the dialog only needs the catalog once it opens.
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts, enabled: product !== null });

  return (
    <Dialog open={product !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {product !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>{recipeTitle(product, null)}</DialogTitle>
            </DialogHeader>

            {products.isPending ? <p>Carregando…</p> : null}

            {products.isError ? (
              <QueryErrorState error={products.error} onRetry={() => void products.refetch()} />
            ) : null}

            {products.isSuccess ? (
              <RecipeForm
                key={product.sku}
                product={product}
                recipe={null}
                catalog={products.data}
                onSaved={onClose}
                secondaryAction={
                  <Button type="button" variant="outline" onClick={onClose}>
                    Deixar para depois
                  </Button>
                }
              />
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
