import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/use-session";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import { SupplierDialog } from "@/features/suppliers/SupplierDialog";
import { fetchSuppliers, suppliersKeys } from "@/features/suppliers/suppliers.api";
import { PageTitle } from "@/components/layout/PageTitle";

export function SuppliersListPage() {
  const suppliers = useQuery({ queryKey: suppliersKeys.all, queryFn: fetchSuppliers });
  const { can } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageTitle>Fornecedores</PageTitle>
        {can("CATALOG_CREATE") ? (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            Novo fornecedor
          </Button>
        ) : null}
      </div>

      {suppliers.isPending ? <p>Carregando…</p> : null}

      {suppliers.isError ? <QueryErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} /> : null}

      {suppliers.isSuccess && suppliers.data.length === 0 ? <p>Nenhum fornecedor cadastrado ainda.</p> : null}

      {suppliers.isSuccess && suppliers.data.length > 0 ? (
        <ArrangeableTable
          tableKey="suppliers"
          fill
          rows={suppliers.data}
          rowKey={(supplier) => supplier.id}
          columns={[{ key: "name", header: "Nome", cell: (supplier) => supplier.name }]}
        />
      ) : null}

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
