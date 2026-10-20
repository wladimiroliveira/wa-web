import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import { Link } from "react-router-dom";
import { dayOf, moneyOf, quantityOf } from "@/features/stock/stock-format";
import { needsAttention, statusReading } from "@/features/stock/stock-status";
import { fetchStockPosition, stockKeys } from "@/features/stock/stock.api";
import { formatMoney } from "@/lib/decimal";
import { PageTitle } from "@/components/layout/PageTitle";

export function StockPositionPage() {
  const position = useQuery({ queryKey: stockKeys.all, queryFn: fetchStockPosition });
  const [onlyAttention, setOnlyAttention] = useState(false);

  const items = position.data?.items ?? [];
  const attention = items.filter((item) => needsAttention(item.status));
  const shown = onlyAttention ? attention : items;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageTitle>Análise de estoque</PageTitle>

      {position.isPending ? <p>Carregando…</p> : null}

      {position.isError ? <QueryErrorState error={position.error} onRetry={() => void position.refetch()} /> : null}

      {position.isSuccess && items.length === 0 ? <p>Nenhum produto cadastrado ainda.</p> : null}

      {position.isSuccess && items.length > 0 ? (
        <>
          <dl role="group" aria-label="Resumo do estoque" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Valor em estoque</dt>
              <dd className="text-xl font-semibold">{formatMoney(position.data.totalValue)}</dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Produtos</dt>
              <dd className="text-xl font-semibold">{items.length}</dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Pedem atenção</dt>
              <dd className="text-xl font-semibold">{attention.length}</dd>
            </div>
          </dl>

          <div className="flex min-h-8 items-center gap-2">
            <Checkbox
              id="stock-only-attention"
              checked={onlyAttention}
              onCheckedChange={(checked) => setOnlyAttention(checked === true)}
            />
            <Label htmlFor="stock-only-attention" className="py-1.5">
              Só o que pede atenção
            </Label>
          </div>

          {shown.length === 0 ? (
            <p>Nenhum produto pede atenção.</p>
          ) : (
            <ArrangeableTable
              tableKey="stock-position"
              rowNoun={{ one: "produto", other: "produtos" }}
              fill
              rows={shown}
              rowKey={(item) => item.product.sku}
              columns={[
                {
                  key: "product",
                  header: "Produto",
                  cell: (item) => (
                    <Link
                      to={`/stock/${item.product.sku}`}
                      className="flex min-h-8 items-center underline underline-offset-4"
                    >
                      {item.product.description}
                    </Link>
                  ),
                },
                { key: "quantity", header: "Saldo", cell: (item) => quantityOf(item.quantity, item.product.unit) },
                {
                  key: "minimum",
                  header: "Mínimo",
                  cell: (item) => quantityOf(item.minimumQuantity, item.product.unit),
                },
                { key: "lots", header: "Lotes", cell: (item) => item.lotCount },
                { key: "next-expiry", header: "Próxima validade", cell: (item) => dayOf(item.nextExpiresAt) },
                { key: "last-cost", header: "Último custo", cell: (item) => moneyOf(item.lastEntryCost) },
                { key: "average-cost", header: "Custo médio", cell: (item) => moneyOf(item.averageCost) },
                { key: "value", header: "Valor", cell: (item) => formatMoney(item.value) },
                {
                  key: "status",
                  header: "Situação",
                  cell: (item) => (
                    <Badge variant={statusReading(item.status).badge}>{statusReading(item.status).label}</Badge>
                  ),
                },
              ]}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
