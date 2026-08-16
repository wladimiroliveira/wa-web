import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionPicker } from "@/features/auth/PermissionPicker";
import type { Permission } from "@/features/auth/permission";
import { toExceptions } from "@/features/auth/permission-diff";
import { useRoles } from "@/features/roles/use-roles";
import { useUser, useUserPermissions } from "@/features/users/use-user";
import { useCreateUser, useUpdateUser } from "@/features/users/use-user-mutations";
import { isFormError } from "@/lib/form-errors";
import { ApiError } from "@/lib/http";

const baseUserSchema = z.object({
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
});

const createUserSchema = baseUserSchema.extend({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(8, "A senha tem pelo menos 8 caracteres"),
});

type CreateForm = z.infer<typeof createUserSchema>;
type UserForm = Partial<CreateForm> & z.infer<typeof baseUserSchema>;

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
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const roles = useRoles();
  const user = useUser(id);
  const userPermissions = useUserPermissions(id);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser(id ?? "");

  const [roleId, setRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserForm>({ resolver: zodResolver(isEditing ? baseUserSchema : createUserSchema) });

  // Seeds the form once the API answers. `reset` — not `setValue` — so the
  // fields also stop counting as dirty.
  useEffect(() => {
    if (!isEditing || !user.data || !userPermissions.data || !roles.data) return;
    reset({ name: user.data.name, username: user.data.username });
    setRoleId(user.data.roleId ?? "");
    setPermissions([...userPermissions.data]);
    setIsActive(user.data.isActive);
  }, [isEditing, user.data, userPermissions.data, roles.data, reset]);

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
      if (isEditing) {
        await updateUser.mutateAsync({
          name: values.name,
          username: values.username,
          roleId: roleId || null,
          grantedPermissions,
          deniedPermissions,
          isActive,
        });
      } else {
        await createUser.mutateAsync({
          name: values.name,
          username: values.username,
          email: values.email!,
          password: values.password!,
          roleId: roleId || null,
          grantedPermissions,
          deniedPermissions,
        });
      }
      navigate("/users", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError(formMessageFor(error));
      else toast.error(toastMessageFor(error));
    }
  });

  const failed = roles.error ?? user.error ?? userPermissions.error;
  if (failed) {
    return (
      <section className="p-8">
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void roles.refetch();
            void user.refetch();
            void userPermissions.refetch();
          }}
        />
        <Link to="/users" className="mt-4 inline-block text-sm underline">
          Voltar para usuários
        </Link>
      </section>
    );
  }
  if (!roles.data || (isEditing && (!user.data || !userPermissions.data))) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <section className="p-8">
      <PageHeader title={isEditing ? user.data!.name : "Novo usuário"} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />
          <Field id="username" label="Usuário" error={errors.username?.message} {...register("username")} />
          {!isEditing && (
            <>
              <Field id="email" label="E-mail" type="email" error={errors.email?.message} {...register("email")} />
              <Field
                id="password"
                label="Senha"
                type="password"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register("password")}
              />
            </>
          )}

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

          {isEditing && (
            <div className="flex items-center gap-2">
              <Checkbox id="isActive" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
              {/* Unlike PermissionPicker's labels, this one keeps `htmlFor`: base-ui
                  puts an explicitly passed `id` on its hidden native input (not on
                  the `<span role="checkbox">`), so `htmlFor="isActive"` targets a
                  real labelable element and the browser forwards the click on its
                  own. `aria-label` would be redundant with that — base-ui already
                  wires `aria-labelledby` to this label once it finds it. */}
              <Label htmlFor="isActive">Usuário ativo</Label>
            </div>
          )}
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
