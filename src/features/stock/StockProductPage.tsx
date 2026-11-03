import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { RowActions, RowActionsItem } from "@/components/common/RowActions";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import { useSession } from "@/features/auth/use-session";
import { LossDialog } from "@/features/losses/LossDialog";
import { dayOf, moneyOf, NOTHING, quantityOf } from "@/features/stock/stock-format";
import { lotStatusReading, statusReading } from "@/features/stock/stock-status";
import { fetchProductStock, stockKeys } from "@/features/stock/stock.api";
import type { StockLot } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { ApiError } from "@/lib/http";
import { PageTitle } from "@/components/layout/PageTitle";

export function StockProductPage() {
  const { sku = "" } = useParams();
  const [depleted, setDepleted] = useState(false);
  const [writingOff, setWritingOff] = useState<StockLot | null>(null);
  const canWriteOff = useSession().can("LOSSES_CREATE");

  const stock = useQuery({
    queryKey: stockKeys.product(sku, depleted),
    queryFn: () => fetchProductStock(sku, depleted),
    // Ticking the box must not blank the page while the longer list is on its way.
    placeholderData: keepPreviousData,
  });

  const missing = stock.error instanceof ApiError && stock.error.status === 404;
  const unit = stock.data?.product.unit;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/stock" className="flex min-h-8 items-center self-start text-sm underline underline-offset-4">
        Voltar para a análise de estoque
      </Link>

      {stock.isPending ? <p>Carregando…</p> : null}

      {missing ? <p role="alert">Esse produto não existe mais.</p> : null}

      {stock.isError && !missing ? <QueryErrorState error={stock.error} onRetry={() => void stock.refetch()} /> : null}

      {stock.isSuccess && unit !== undefined ? (
        <>
          <PageTitle>{stock.data.product.description}</PageTitle>

          <dl role="group" aria-label="Resumo do produto" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Saldo</dt>
              <dd className="text-xl font-semibold">{quantityOf(stock.data.quantity, unit)}</dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Valor em estoque</dt>
              <dd className="text-xl font-semibold">{moneyOf(stock.data.value)}</dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Próxima validade</dt>
              <dd className="text-xl font-semibold">{dayOf(stock.data.nextExpiresAt)}</dd>
            </div>
            <div className="rounded-md border p-4">
              <dt className="text-sm text-muted-foreground">Situação</dt>
              <dd>
                <Badge variant={statusReading(stock.data.status).badge}>{statusReading(stock.data.status).label}</Badge>
              </dd>
            </div>
          </dl>

          <div className="flex min-h-8 items-center gap-2">
            <Checkbox
              id="stock-depleted-lots"
              checked={depleted}
              onCheckedChange={(checked) => setDepleted(checked === true)}
            />
            <Label htmlFor="stock-depleted-lots" className="py-1.5">
              Mostrar lotes esgotados
            </Label>
          </div>

          {stock.data.lots.length === 0 ? (
            <p>{depleted ? "Nenhum lote registrado." : "Nenhum lote com saldo."}</p>
          ) : (
            <ArrangeableTable
              tableKey="stock-lots"
              rowNoun={{ one: "lote", other: "lotes" }}
              rows={stock.data.lots}
              rowKey={(lot) => lot.id}
              columns={[
                { key: "expiry", header: "Validade", cell: (lot) => dayOf(lot.expiresAt, "Sem validade") },
                { key: "supplier", header: "Fornecedor", cell: (lot) => lot.supplier?.name ?? NOTHING },
                { key: "entered-at", header: "Entrada", cell: (lot) => formatDateTime(lot.createdAt) },
                {
                  key: "initial-quantity",
                  header: "Qtd. inicial",
                  cell: (lot) => quantityOf(lot.initialQuantity, unit),
                },
                { key: "quantity", header: "Saldo", cell: (lot) => quantityOf(lot.quantity, unit) },
                { key: "unit-cost", header: "Custo unitário", cell: (lot) => moneyOf(lot.unitCost) },
                { key: "value", header: "Valor", cell: (lot) => moneyOf(lot.value) },
                {
                  key: "status",
                  header: "Situação",
                  cell: (lot) => (
                    <Badge variant={lotStatusReading(lot.status).badge}>{lotStatusReading(lot.status).label}</Badge>
                  ),
                },
                ...(canWriteOff
                  ? [
                      {
                        key: "actions",
                        header: "Ações",
                        cell: (lot: StockLot) =>
                          lot.status === "DEPLETED" ? null : (
                            <RowActions label="Ações do lote">
                              <RowActionsItem onClick={() => setWritingOff(lot)}>Registrar avaria</RowActionsItem>
                            </RowActions>
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          )}

          <LossDialog
            lot={writingOff}
            unit={unit}
            productName={stock.data.product.description}
            onOpenChange={(open) => setWritingOff(open ? writingOff : null)}
          />
        </>
      ) : null}
    </div>
  );
}
