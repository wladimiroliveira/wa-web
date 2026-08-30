import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { RoleDialog } from "@/features/roles/RoleDialog";
import { fetchRoles, rolesKeys } from "@/features/roles/roles.api";
import type { Role } from "@/lib/api";
import { labelFor } from "@/lib/permissions";

export function RolesListPage() {
  const roles = useQuery({ queryKey: rolesKeys.all, queryFn: fetchRoles });
  const { can } = useSession();
  const [editing, setEditing] = useState<Role | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openFor(role: Role | null): void {
    setEditing(role);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Papéis</h1>
        {can("ACCESS_CREATE") ? (
          <Button type="button" onClick={() => openFor(null)}>
            Novo papel
          </Button>
        ) : null}
      </div>

      {roles.isPending ? <p>Carregando…</p> : null}

      {roles.isError ? <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : null}

      {roles.isSuccess && roles.data.length === 0 ? <p>Nenhum papel cadastrado ainda.</p> : null}

      {roles.isSuccess && roles.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.data.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <Badge key={permission} variant="secondary">
                        {labelFor(permission)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {can("ACCESS_UPDATE") ? (
                    <Button type="button" variant="outline" onClick={() => openFor(role)}>
                      Editar
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <RoleDialog role={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
