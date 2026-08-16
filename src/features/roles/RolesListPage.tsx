import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useDeleteRole } from "@/features/roles/use-role-mutations";
import { useRoles } from "@/features/roles/use-roles";
import { ApiError } from "@/lib/http";

/**
 * The list has no form to keep a fixable error in, so every deletion failure
 * — including one the API refuses with a 4xx — surfaces as a toast. Mirrors
 * the error-routing rule from UserFormPage, minus the form half of it.
 */
function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir. Verifique sua conexão.";
}

export function RolesListPage() {
  const roles = useRoles();
  const deleteRole = useDeleteRole();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "USERS_WRITE");
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  function onConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    deleteRole.mutate(id, { onError: (error) => toast.error(toastMessageFor(error)) });
  }

  return (
    <section className="p-8">
      <PageHeader title="Papéis">
        {canWrite && (
          <Link to="/roles/new" className={buttonVariants({ size: "sm" })}>
            Novo papel
          </Link>
        )}
      </PageHeader>

      {roles.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum papel cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.data.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/roles/${role.id}`} className="underline-offset-2 hover:underline">
                      {role.name}
                    </Link>
                  ) : (
                    role.name
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{role.permissions.length}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setPendingId(role.id)}>
                      Excluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingId !== null}
        onOpenChange={(open) => !open && setPendingId(null)}
        title="Excluir papel"
        description="Quem usa este papel fica sem papel, mantendo apenas as permissões dadas na mão. Não dá para desfazer."
        confirmLabel="Excluir papel"
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
