import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { fetchPreWeighings, preWeighingsKeys } from "@/features/pre-weighings/pre-weighings.api";
import { quantityOf } from "@/features/stock/stock-format";
import { formatDateTime } from "@/lib/dates";
import { PageTitle } from "@/components/layout/PageTitle";

export function PreWeighingsListPage() {
  const { can } = useSession();

  // The same permissions the route of the form asks for: a link there must not land on a refusal.
  const canRecord = can("PRODUCTION_CREATE") && can("CATALOG_READ");

  const preWeighings = useInfiniteQuery({
    queryKey: preWeighingsKeys.list(),
    queryFn: ({ pageParam }) => fetchPreWeighings({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = preWeighings.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageTitle>Pré-pesagens</PageTitle>

      {canRecord ? (
        <Link to="/pre-weighings/new" className={buttonVariants({ className: "self-start" })}>
          Nova pré-pesagem
        </Link>
      ) : null}

      {preWeighings.isPending ? <p>Carregando…</p> : null}

      {preWeighings.isError ? (
        <QueryErrorState error={preWeighings.error} onRetry={() => void preWeighings.refetch()} />
      ) : null}

      {preWeighings.isSuccess && items.length === 0 ? <p>Nenhuma pré-pesagem registrada.</p> : null}

      {preWeighings.isSuccess && items.length > 0 ? (
        <Table fill>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade a produzir</TableHead>
              <TableHead>Ingredientes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((preWeighing) => (
              <TableRow key={preWeighing.id}>
                <TableCell>{formatDateTime(preWeighing.createdAt)}</TableCell>
                <TableCell>
                  <Link
                    to={`/pre-weighings/${preWeighing.id}`}
                    className="flex min-h-11 items-center underline underline-offset-4"
                  >
                    {preWeighing.product.description}
                  </Link>
                </TableCell>
                <TableCell>{quantityOf(preWeighing.quantity, preWeighing.product.unit)}</TableCell>
                <TableCell>{preWeighing.items.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {preWeighings.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={preWeighings.isFetchingNextPage}
          onClick={() => void preWeighings.fetchNextPage()}
        >
          Carregar mais
        </Button>
      ) : null}
    </div>
  );
}
