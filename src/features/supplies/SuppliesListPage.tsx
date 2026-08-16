import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { SUPPLY_TYPE_LABELS } from "@/features/supplies/supply-labels";
import { useDeleteSupply } from "@/features/supplies/use-supply-mutations";
import { useSupplies } from "@/features/supplies/use-supplies";
import { formatCurrency } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { formatWithUnit } from "@/lib/unit";

/**
 * `RecipeItem.supplyId` and `StockMovement.supplyId` are both `onDelete:
 * Restrict` in the API's schema, so those are the only two references a 409 can
 * mean. The API's own sentence names neither; here the precision is legitimate.
 */
function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "Não é possível excluir um insumo que já tem movimentação de estoque ou que faz parte de uma receita.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir. Verifique sua conexão.";
}

export function SuppliesListPage() {
  const supplies = useSupplies();
  const deleteSupply = useDeleteSupply();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "SUPPLIES_WRITE");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (supplies.isError) return <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />;
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  function onConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    deleteSupply.mutate(id, { onError: (error) => toast.error(toastMessageFor(error)) });
  }

  return (
    <section className="p-8">
      <PageHeader title="Insumos">
        {canWrite && (
          <Link to="/supplies/new" className={buttonVariants({ size: "sm" })}>
            Novo insumo
          </Link>
        )}
      </PageHeader>

      {supplies.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Compra</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplies.data.map((supply) => (
              <TableRow key={supply.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/supplies/${supply.id}`} className="underline-offset-2 hover:underline">
                      {supply.name}
                    </Link>
                  ) : (
                    supply.name
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{SUPPLY_TYPE_LABELS[supply.type]}</Badge>
                </TableCell>
                {/* `purchaseQty` is already in `purchaseUnit` — it is not a base
                    quantity, so it is formatted without converting. */}
                <TableCell className="tabular-nums">
                  {formatWithUnit(supply.purchaseQty, supply.purchaseUnit)}
                </TableCell>
                <TableCell className="tabular-nums">{formatCurrency(supply.purchasePrice)}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(supply.id)}>
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
        title="Excluir insumo"
        description="Só é possível excluir um insumo que nunca foi movimentado e não faz parte de nenhuma receita. Não dá para desfazer."
        confirmLabel="Excluir insumo"
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
