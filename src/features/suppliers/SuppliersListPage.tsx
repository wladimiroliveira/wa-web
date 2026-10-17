import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { SupplierDialog } from "@/features/suppliers/SupplierDialog";
import { fetchSuppliers, suppliersKeys } from "@/features/suppliers/suppliers.api";
import { PageTitle } from "@/components/layout/PageTitle";

export function SuppliersListPage() {
  const suppliers = useQuery({ queryKey: suppliersKeys.all, queryFn: fetchSuppliers });
  const { can } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.data.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell>{supplier.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
