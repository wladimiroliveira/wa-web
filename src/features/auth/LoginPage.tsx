import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useLogin } from "@/features/auth/use-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/http";

const loginSchema = z.object({
  username: z.string().trim().min(3, "O usuário tem pelo menos 3 caracteres").max(30),
  password: z.string().min(1, "Informe sua senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

/** The API answers in Portuguese, so its message is shown as-is when it has one. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "Muitas tentativas de entrada. Espere alguns minutos e tente de novo.";
  }
  if (error instanceof ApiError) return error.message;
  return "Não foi possível entrar. Verifique sua conexão.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(messageFor(error));
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Entrar no wa-system</h1>

        <div className="space-y-1.5">
          <Label htmlFor="username">Usuário</Label>
          <Input id="username" autoComplete="username" autoFocus {...register("username")} />
          {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Entrar
        </Button>
      </form>
    </main>
  );
}
