import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { useCreateRole, useUpdateRole } from "@/features/roles/use-role-mutations";
import { useRoles } from "@/features/roles/use-roles";
import { ApiError } from "@/lib/http";

const roleSchema = z.object({ name: z.string().trim().min(1, "Informe o nome do papel") });

type RoleForm = z.infer<typeof roleSchema>;

/**
 * The screen's error-routing rule, mirroring UserFormPage: what a person can
 * fix by editing the form — a 4xx the API rejected the submission for —
 * stays in the form. What they cannot fix that way — a 500, or any failure
 * that is not a 4xx — is not the form's problem to display, so it becomes a
 * toast instead.
 */
function isFormError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

function formMessageFor(error: ApiError): string {
  // `name` is the only unique column on roles, so a conflict can be pinned to
  // the field precisely — unlike users, where it could be the username or the
  // email and the API does not say which.
  if (error.status === 409) {
    return "Já existe um papel com esse nome.";
  }
  return error.message;
}

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível salvar. Verifique sua conexão.";
}

export function RoleFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const roles = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole(id ?? "");

  const [permissions, setPermissions] = useState<Permission[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoleForm>({ resolver: zodResolver(roleSchema) });

  const role = roles.data?.find((candidate) => candidate.id === id);

  // There is no GET /roles/:id — the list is the only source, so the form seeds
  // itself once the list lands.
  useEffect(() => {
    if (!isEditing || !role) return;
    reset({ name: role.name });
    setPermissions([...role.permissions]);
  }, [isEditing, role, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing) await updateRole.mutateAsync({ name: values.name, permissions });
      else await createRole.mutateAsync({ name: values.name, permissions });
      navigate("/roles", { replace: true });
    } catch (error) {
      if (isFormError(error)) setError("name", { message: formMessageFor(error) });
      else toast.error(toastMessageFor(error));
    }
  });

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={isEditing ? (role?.name ?? "Papel") : "Novo papel"} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">Permissões deste papel</h2>
          <PermissionPicker value={permissions} onChange={setPermissions} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Link to="/roles" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
