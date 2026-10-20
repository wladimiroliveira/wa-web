import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import { useSession } from "@/features/auth/use-session";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { dayOf, NOTHING } from "@/features/stock/stock-format";
import { movementDirection, movementOrigin } from "@/features/stock-movements/movement-types";
import { fetchStockMovements, stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { formatDateTime } from "@/lib/dates";
import { formatDecimal, formatMoney } from "@/lib/decimal";
import { unitLabel } from "@/lib/units";
import { PageTitle } from "@/components/layout/PageTitle";

export function StockMovementsPage() {
  const { can } = useSession();
  const [productSku, setProductSku] = useState<string | undefined>(undefined);

  // The filter is a convenience on top of the history: without the catalog the
  // history still opens, just unfiltered.
  const canFilter = can("CATALOG_READ");
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts, enabled: canFilter });

  const movements = useInfiniteQuery({
    queryKey: stockMovementsKeys.list(productSku),
    queryFn: ({ pageParam }) => fetchStockMovements({ productSku, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = movements.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageTitle>Movimentações</PageTitle>

      {canFilter && products.isSuccess ? (
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="movements-product">Produto</Label>
          <NativeSelect
            id="movements-product"
            value={productSku ?? ""}
            onChange={(event) => setProductSku(event.target.value === "" ? undefined : event.target.value)}
          >
            <option value="">Todos os produtos</option>
            {products.data.map((product) => (
              <option key={product.sku} value={product.sku}>
                {product.description}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {movements.isPending ? <p>Carregando…</p> : null}

      {movements.isError ? <QueryErrorState error={movements.error} onRetry={() => void movements.refetch()} /> : null}

      {movements.isSuccess && items.length === 0 ? <p>Nenhuma movimentação encontrada.</p> : null}

      {movements.isSuccess && items.length > 0 ? (
        <ArrangeableTable
          tableKey="stock-movements"
          rowNoun={{ one: "movimentação", other: "movimentações" }}
          fill
          rows={items}
          rowKey={(movement) => movement.id}
          columns={[
            { key: "date", header: "Data", cell: (movement) => formatDateTime(movement.createdAt) },
            { key: "product", header: "Produto", cell: (movement) => movement.product.description },
            {
              key: "lot-expiry",
              header: "Validade do lote",
              cell: (movement) => (movement.lot === null ? NOTHING : dayOf(movement.lot.expiresAt, "Sem validade")),
            },
            {
              key: "direction",
              header: "Tipo",
              cell: (movement) => (
                <Badge variant={movementDirection(movement.type).badge}>{movementDirection(movement.type).label}</Badge>
              ),
            },
            { key: "origin", header: "Origem", cell: (movement) => movementOrigin(movement.type) },
            {
              key: "quantity",
              header: "Quantidade",
              cell: (movement) => (
                <>
                  {movementDirection(movement.type).sign}
                  {formatDecimal(movement.quantity)} {unitLabel(movement.product.unit)}
                </>
              ),
            },
            { key: "unit-cost", header: "Custo unitário", cell: (movement) => formatMoney(movement.unitCost) },
            { key: "author", header: "Lançado por", cell: (movement) => movement.createdBy.name },
          ]}
        />
      ) : null}

      {movements.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={movements.isFetchingNextPage}
          onClick={() => void movements.fetchNextPage()}
        >
          Carregar mais
        </Button>
      ) : null}
    </div>
  );
}
