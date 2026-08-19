import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { toPercent } from "@/features/recipes/margin";
import { useDeleteRecipe } from "@/features/recipes/use-recipe-mutations";
import { useRecipes } from "@/features/recipes/use-recipes";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { formatWithUnit } from "@/lib/unit";

/**
 * `Production.recipeId` is the only `onDelete: Restrict` reference to `Recipe`
 * in the API's schema, so a 409 has exactly one cause. The API answers any
 * P2003 with "Operação viola uma referência existente", which tells nobody what
 * to do; the sentence below does.
 */
function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "Não é possível excluir uma receita que já tem produção registrada.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir. Verifique sua conexão.";
}

export function RecipesListPage() {
  const recipes = useRecipes();
  const deleteRecipe = useDeleteRecipe();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "RECIPES_WRITE");
  const canReadPricing = hasPermission(me?.permissions ?? [], "PRICING_READ");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (recipes.isError) return <QueryErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />;
  if (!recipes.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  function onConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    deleteRecipe.mutate(id, { onError: (error) => toast.error(toastMessageFor(error)) });
  }

  return (
    <section className="p-8">
      <PageHeader title="Receitas">
        {canWrite && (
          <Link to="/recipes/new" className={buttonVariants({ size: "sm" })}>
            Nova receita
          </Link>
        )}
      </PageHeader>

      {recipes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Rendimento</TableHead>
              <TableHead>Mão de obra / cento</TableHead>
              <TableHead>Margem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.data.map((recipe) => (
              <TableRow key={recipe.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/recipes/${recipe.id}`} className="underline-offset-2 hover:underline">
                      {recipe.name}
                    </Link>
                  ) : (
                    recipe.name
                  )}
                </TableCell>
                {/* `batchYield` counts pieces per batch — the pricing divides it
                    by 100 to reach the hundred — so it reads in units. */}
                <TableCell className="tabular-nums">{formatWithUnit(recipe.batchYield, "UN")}</TableCell>
                <TableCell className="tabular-nums">{formatCurrency(recipe.laborCostPerHundred)}</TableCell>
                <TableCell className="tabular-nums">{formatQuantity(toPercent(recipe.margin))} %</TableCell>
                <TableCell className="space-x-2 text-right">
                  {canReadPricing && (
                    <Link
                      to={`/recipes/${recipe.id}/pricing`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Preço
                    </Link>
                  )}
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(recipe.id)}>
                      Excluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingId !== null}
        onOpenChange={(open) => !open && setPendingId(null)}
        title="Excluir receita"
        description="Só é possível excluir uma receita que nunca foi produzida. Não dá para desfazer."
        confirmLabel="Excluir receita"
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
