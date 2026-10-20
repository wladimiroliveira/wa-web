import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RecipeForm, recipeTitle } from "@/features/recipes/RecipeForm";
import { RecipeView } from "@/features/recipes/RecipeView";
import { fetchRecipe, recipesKeys } from "@/features/recipes/recipes.api";
import type { Product } from "@/lib/api";

export interface RecipeSheetTarget {
  product: Product;
  /** How the sheet opens: on the recipe to read, or straight into its form. */
  mode: "view" | "edit";
}

interface RecipeSheetProps {
  /** The recipe to show, or `null` while there is none. */
  target: RecipeSheetTarget | null;
  /** The products an ingredient is chosen from. */
  catalog: Product[];
  onClose: () => void;
}

/** The recipe of one product beside the list: read first, and turned into a form only on request. */
export function RecipeSheet({ target, catalog, onClose }: RecipeSheetProps) {
  // Each opening starts over, in the mode it asked for and with nothing typed.
  return target === null ? null : (
    <OpenRecipeSheet key={`${target.product.sku}:${target.mode}`} {...target} catalog={catalog} onClose={onClose} />
  );
}

/** What the operator was doing when they asked to leave a form with changes in it. */
type Leaving = "cancel" | "close";

function OpenRecipeSheet({
  product,
  mode: initialMode,
  catalog,
  onClose,
}: RecipeSheetTarget & Omit<RecipeSheetProps, "target">) {
  const [mode, setMode] = useState(initialMode);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  const recipe = useQuery({
    queryKey: recipesKeys.detail(product.sku),
    queryFn: () => fetchRecipe(product.sku),
    // A recipe is read anew each time the sheet opens, and never refetched behind the operator,
    // which would throw away the rows they are typing into.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
  });

  function read(): void {
    setDirty(false);
    setMode("view");
  }

  function leave(how: Leaving): void {
    if (mode === "edit" && dirty) setLeaving(how);
    else if (how === "close") onClose();
    else read();
  }

  function discard(): void {
    const how = leaving;

    setLeaving(null);
    if (how === "close") onClose();
    else read();
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : leave("close"))}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            {recipeTitle(product, recipe.isSuccess ? recipe.data : null)}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {recipe.isPending ? <p>Carregando a receita…</p> : null}

          {recipe.isError ? <QueryErrorState error={recipe.error} onRetry={() => void recipe.refetch()} /> : null}

          {recipe.isSuccess && mode === "view" && recipe.data === null ? (
            <div className="flex flex-col items-start gap-3">
              <p>{product.description} ainda não tem receita.</p>
              <Button type="button" onClick={() => setMode("edit")}>
                Criar receita
              </Button>
            </div>
          ) : null}

          {recipe.isSuccess && mode === "view" && recipe.data !== null ? (
            <>
              <RecipeView recipe={recipe.data} />
              <Button type="button" className="self-start" onClick={() => setMode("edit")}>
                Editar receita
              </Button>
            </>
          ) : null}

          {recipe.isSuccess && mode === "edit" ? (
            <RecipeForm
              product={product}
              recipe={recipe.data}
              catalog={catalog}
              onSaved={read}
              onDirtyChange={setDirty}
              secondaryAction={
                <Button type="button" variant="outline" onClick={() => leave("cancel")}>
                  Cancelar
                </Button>
              }
            />
          ) : null}
        </div>
      </SheetContent>

      <AlertDialog open={leaving !== null} onOpenChange={(open) => (open ? undefined : setLeaving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>O que foi mudado na receita ainda não foi salvo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
