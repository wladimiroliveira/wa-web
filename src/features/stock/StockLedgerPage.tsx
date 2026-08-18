import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOVEMENT_TYPE_LABELS } from "@/features/stock/movement-labels";
import { useMovements } from "@/features/stock/use-movements";
import { useSupply } from "@/features/supplies/use-supply";
import { formatDate } from "@/lib/format";
import { formatInUnit } from "@/lib/unit";

export function StockLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const supply = useSupply(id);
  const movements = useMovements(id);

  const failed = supply.error ?? movements.error;
  if (failed) {
    return (
      <section className="p-8">
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void supply.refetch();
            void movements.refetch();
          }}
        />
        <Link to="/stock" className="mt-4 inline-block text-sm underline">
          Voltar para estoque
        </Link>
      </section>
    );
  }
  if (!supply.data || !movements.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  const rows = movements.data.pages.flatMap((page) => page.data);

  return (
    <section className="p-8">
      <PageHeader title={supply.data.name}>
        <p className="text-sm text-muted-foreground">
          Saldo: {formatInUnit(supply.data.currentStock, supply.data.purchaseUnit)}
        </p>
      </PageHeader>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="tabular-nums">{formatDate(movement.createdAt)}</TableCell>
                  <TableCell>{MOVEMENT_TYPE_LABELS[movement.type]}</TableCell>
                  {/* The sign comes from the stored quantity, not from the type:
                      production and waste are already negative in the ledger. */}
                  <TableCell className="tabular-nums">
                    {movement.quantityBase > 0 ? "+" : ""}
                    {formatInUnit(movement.quantityBase, supply.data.purchaseUnit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{movement.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {movements.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={movements.isFetchingNextPage}
              onClick={() => void movements.fetchNextPage()}
            >
              Carregar mais
            </Button>
          )}
        </>
      )}

      <Link to="/stock" className="mt-6 inline-block text-sm underline">
        Voltar para estoque
      </Link>
    </section>
  );
}
