import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { IconButton } from "@/components/common/IconButton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
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

      {preWeighings.isPending ? <p>Carregando…</p> : null}

      {preWeighings.isError ? (
        <QueryErrorState error={preWeighings.error} onRetry={() => void preWeighings.refetch()} />
      ) : null}

      {preWeighings.isSuccess && items.length === 0 ? (
        <EmptyState
          actions={
            canRecord ? (
              <Link to="/pre-weighings/new" className={buttonVariants({ variant: "outline" })}>
                Nova pré-pesagem
              </Link>
            ) : null
          }
        >
          Nenhuma pré-pesagem registrada.
        </EmptyState>
      ) : null}

      {preWeighings.isSuccess && items.length > 0 ? (
        <ArrangeableTable
          tableKey="pre-weighings"
          actions={
            canRecord ? (
              <IconButton label="Nova pré-pesagem" variant="default" to="/pre-weighings/new">
                <PlusIcon aria-hidden="true" />
              </IconButton>
            ) : null
          }
          rowNoun={{ one: "pré-pesagem", other: "pré-pesagens" }}
          fill
          rows={items}
          rowKey={(preWeighing) => preWeighing.id}
          columns={[
            { key: "date", header: "Data", cell: (preWeighing) => formatDateTime(preWeighing.createdAt) },
            {
              key: "product",
              header: "Produto",
              cell: (preWeighing) => (
                <Link
                  to={`/pre-weighings/${preWeighing.id}`}
                  className="flex min-h-8 items-center underline underline-offset-4"
                >
                  {preWeighing.product.description}
                </Link>
              ),
            },
            {
              key: "quantity",
              header: "Quantidade a produzir",
              cell: (preWeighing) => quantityOf(preWeighing.quantity, preWeighing.product.unit),
            },
            { key: "ingredients", header: "Ingredientes", cell: (preWeighing) => preWeighing.items.length },
          ]}
        />
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
