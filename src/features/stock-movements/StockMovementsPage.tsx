import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { dayOf, NOTHING } from "@/features/stock/stock-format";
import { movementLabel, movementSign } from "@/features/stock-movements/movement-types";
import { fetchStockMovements, stockMovementsKeys } from "@/features/stock-movements/stock-movements.api";
import { formatDateTime } from "@/lib/dates";
import { formatDecimal, formatMoney } from "@/lib/decimal";
import { unitLabel } from "@/lib/units";

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
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Movimentações</h1>

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Validade do lote</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Custo unitário</TableHead>
              <TableHead>Lançado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                <TableCell>{movement.product.description}</TableCell>
                <TableCell>{movement.lot === null ? NOTHING : dayOf(movement.lot.expiresAt, "Sem validade")}</TableCell>
                <TableCell>{movementLabel(movement.type)}</TableCell>
                <TableCell>
                  {movementSign(movement.type)}
                  {formatDecimal(movement.quantity)} {unitLabel(movement.product.unit)}
                </TableCell>
                <TableCell>{formatMoney(movement.unitCost)}</TableCell>
                <TableCell>{movement.createdBy.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
