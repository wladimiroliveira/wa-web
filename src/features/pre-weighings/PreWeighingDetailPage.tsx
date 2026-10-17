import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchPreWeighing, preWeighingsKeys } from "@/features/pre-weighings/pre-weighings.api";
import { quantityOf } from "@/features/stock/stock-format";
import { formatDateTime } from "@/lib/dates";
import { ApiError } from "@/lib/http";
import { PageTitle } from "@/components/layout/PageTitle";

export function PreWeighingDetailPage() {
  const { id = "" } = useParams();

  const preWeighing = useQuery({ queryKey: preWeighingsKeys.detail(id), queryFn: () => fetchPreWeighing(id) });

  const missing = preWeighing.error instanceof ApiError && preWeighing.error.status === 404;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/pre-weighings" className="flex min-h-11 items-center self-start text-sm underline underline-offset-4">
        Voltar para as pré-pesagens
      </Link>

      {preWeighing.isPending ? <p>Carregando…</p> : null}

      {missing ? <p role="alert">Essa pré-pesagem não existe.</p> : null}

      {preWeighing.isError && !missing ? (
        <QueryErrorState error={preWeighing.error} onRetry={() => void preWeighing.refetch()} />
      ) : null}

      {preWeighing.isSuccess ? (
        <>
          <PageTitle>Pré-pesagem de {preWeighing.data.product.description}</PageTitle>

          <dl role="group" aria-label="Resumo da pré-pesagem" className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Quantidade a produzir</dt>
              <dd className="text-xl font-semibold">
                {quantityOf(preWeighing.data.quantity, preWeighing.data.product.unit)}
              </dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Registrada em</dt>
              <dd className="text-xl font-semibold">{formatDateTime(preWeighing.data.createdAt)}</dd>
            </div>
          </dl>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Planejado</TableHead>
                <TableHead>Pesado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preWeighing.data.items.map(({ product, plannedQuantity, weighedQuantity }) => (
                <TableRow key={product.sku}>
                  <TableCell>{product.description}</TableCell>
                  <TableCell>{quantityOf(plannedQuantity, product.unit)}</TableCell>
                  <TableCell>{quantityOf(weighedQuantity, product.unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </div>
  );
}
