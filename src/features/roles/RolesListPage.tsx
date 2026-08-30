import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchRoles, rolesKeys } from "@/features/roles/roles.api";
import { labelFor } from "@/lib/permissions";

export function RolesListPage() {
  const roles = useQuery({ queryKey: rolesKeys.all, queryFn: fetchRoles });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Papéis</h1>

      {roles.isPending ? <p>Carregando…</p> : null}

      {roles.isError ? <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : null}

      {roles.isSuccess && roles.data.length === 0 ? <p>Nenhum papel cadastrado ainda.</p> : null}

      {roles.isSuccess && roles.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
