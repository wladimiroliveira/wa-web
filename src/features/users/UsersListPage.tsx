import { Link } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";
import { useRoles } from "@/features/roles/use-roles";
import { useUsers } from "@/features/users/use-users";

export function UsersListPage() {
  const users = useUsers();
  const roles = useRoles();
  const { data: me } = useSession();
  const canWrite = hasPermission(me?.permissions ?? [], "USERS_WRITE");

  if (users.isError) return <QueryErrorState error={users.error} onRetry={() => void users.refetch()} />;
  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!users.data || !roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  const roleNameById = new Map(roles.data.map((role) => [role.id, role.name]));

  return (
    <section className="p-8">
      <PageHeader title="Usuários">
        {canWrite && (
          <Link to="/users/new" className={buttonVariants({ size: "sm" })}>
            Novo usuário
          </Link>
        )}
      </PageHeader>

      {users.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {canWrite ? (
                    <Link to={`/users/${user.id}`} className="underline-offset-2 hover:underline">
                      {user.name}
                    </Link>
                  ) : (
                    user.name
                  )}
                </TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roleId ? (roleNameById.get(user.roleId) ?? "—") : "—"}</TableCell>
                <TableCell>{user.isActive ? "Ativo" : "Inativo"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
