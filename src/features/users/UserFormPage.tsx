import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { toExceptions } from "@/features/auth/permission-diff";
import { useRoles } from "@/features/roles/use-roles";
import { useCreateUser } from "@/features/users/use-user-mutations";
import { ApiError } from "@/lib/http";

const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  // Mirrors the API: it lowercases anyway, so doing it here keeps the screen
  // honest about what was saved.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O usuário tem pelo menos 3 caracteres")
    .max(30, "O usuário tem no máximo 30 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, traço e sublinhado"),
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(8, "A senha tem pelo menos 8 caracteres"),
});

type UserForm = z.infer<typeof userSchema>;

interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

/**
 * No `forwardRef`: in React 19 `ref` is an ordinary prop, so spreading
 * `register("name")` carries it straight through to the input.
 */
function Field({ id, label, error, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The screen's error-routing rule: what a person can fix by editing the form
 * — a validation error the API rejected the submission for — stays in the
 * form. What they cannot fix that way — a `500`, or any other failure that
 * is not a 4xx — is not the form's problem to display, so it is not a form
 * error at all.
 */
function isFormError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

function formMessageFor(error: ApiError): string {
  // The API answers any unique violation with the same sentence and never says
  // which field. On users the clash can be the username or the email, so the
  // screen names both instead of faking a precision the API did not give.
  if (error.status === 409) {
    return "Já existe um usuário com esse nome de usuário ou e-mail.";
  }
  return error.message;
}

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível salvar. Verifique sua conexão.";
}

export function UserFormPage() {
  const navigate = useNavigate();
  const roles = useRoles();
  const createUser = useCreateUser();

  const [roleId, setRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const rolePermissions = roles.data?.find((role) => role.id === roleId)?.permissions ?? [];

  /** Picking a role applies that role: the checks become exactly what it grants. */
  function onRoleChange(nextRoleId: string) {
    setRoleId(nextRoleId);
    setPermissions([...(roles.data?.find((role) => role.id === nextRoleId)?.permissions ?? [])]);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { grantedPermissions, deniedPermissions } = toExceptions(permissions, rolePermissions);

    try {
      await createUser.mutateAsync({
        ...values,
        roleId: roleId || null,
        grantedPermissions,
        deniedPermissions,
      });
      navigate("/users", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError(formMessageFor(error));
      else toast.error(toastMessageFor(error));
    }
  });

  if (roles.isError) return <QueryErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title="Novo usuário" />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />
          <Field id="username" label="Usuário" error={errors.username?.message} {...register("username")} />
          <Field id="email" label="E-mail" type="email" error={errors.email?.message} {...register("email")} />
          <Field
            id="password"
            label="Senha"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="roleId">Papel</Label>
            <select
              id="roleId"
              value={roleId}
              onChange={(event) => onRoleChange(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Sem papel</option>
              {roles.data.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">Permissões deste usuário</h2>
          <PermissionPicker value={permissions} onChange={setPermissions} rolePermissions={rolePermissions} />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Link to="/users" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
