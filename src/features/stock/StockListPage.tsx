import { Link } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useSupplies } from "@/features/supplies/use-supplies";
import { formatInUnit } from "@/lib/unit";

export function StockListPage() {
  const supplies = useSupplies();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "STOCK_WRITE");

  if (supplies.isError) return <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />;
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title="Estoque" />

      {supplies.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplies.data.map((supply) => (
              <TableRow key={supply.id}>
                <TableCell className="font-medium">
                  <Link to={`/stock/${supply.id}`} className="underline-offset-2 hover:underline">
                    {supply.name}
                  </Link>
                </TableCell>
                <TableCell
                  data-negative={supply.currentStock < 0}
                  className="tabular-nums data-[negative=true]:text-destructive"
                >
                  {formatInUnit(supply.currentStock, supply.purchaseUnit)}
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm">
                      Entrada
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
