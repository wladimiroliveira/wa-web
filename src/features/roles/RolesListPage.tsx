import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RowActions, RowActionsItem } from "@/components/common/RowActions";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { DeleteRoleDialog } from "@/features/roles/DeleteRoleDialog";
import { RoleDialog } from "@/features/roles/RoleDialog";
import { fetchRoles, rolesKeys } from "@/features/roles/roles.api";
import type { Role } from "@/lib/api";
import { labelFor } from "@/lib/permissions";
import { PageTitle } from "@/components/layout/PageTitle";

export function RolesListPage() {
  const roles = useQuery({ queryKey: rolesKeys.all, queryFn: fetchRoles });
  const { can } = useSession();
  const [editing, setEditing] = useState<Role | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);

  function openFor(role: Role | null): void {
    setEditing(role);
    setDialogOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageTitle>Papéis</PageTitle>
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
        <Table fill>
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
                    <RowActions label={`Ações de ${role.name}`}>
                      <RowActionsItem onClick={() => openFor(role)}>Editar</RowActionsItem>
                      <RowActionsItem variant="destructive" onClick={() => setDeleting(role)}>
                        Excluir
                      </RowActionsItem>
                    </RowActions>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <RoleDialog role={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <DeleteRoleDialog role={deleting} onOpenChange={(open) => setDeleting(open ? deleting : null)} />
    </div>
  );
}
