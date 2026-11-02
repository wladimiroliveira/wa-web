"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SIGN_IN_RETURN_PARAM } from "@/features/auth/RequireSession";
import { useSession } from "@/features/auth/use-session";
import { messageForError } from "@/lib/form-errors";

const loginSchema = z.object({
  username: z.string().min(1, "Informe o usuário."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginForm = z.infer<typeof loginSchema>;

// A wrong password and an unknown user are the same answer on purpose — the API
// refuses to tell them apart, and the screen must not undo that.
const SIGN_IN_MESSAGES = {
  401: "Usuário ou senha inválidos.",
  // The API allows five attempts per minute; the sixth gets a 429 the operator
  // must not read as "try again right now" — that just fails a sixth time.
  429: "Muitas tentativas. Espere um minuto e tente de novo.",
};

// Only a path of this application is a place to go back to. An absolute address written into
// the query by someone else would turn the sign-in screen into a redirect to anywhere.
function returnPathOf(params: URLSearchParams): string {
  const from = params.get(SIGN_IN_RETURN_PARAM);

  return from !== null && from.startsWith("/") && !from.startsWith("//") ? from : "/";
}

export function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);

    try {
      await signIn(values);
      router.replace(returnPathOf(searchParams));
    } catch (error) {
      setFailure(messageForError(error, SIGN_IN_MESSAGES));
    }
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Usuário</Label>
          <Input id="username" autoComplete="username" autoFocus {...form.register("username")} />
          {form.formState.errors.username ? (
            <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>
    </main>
  );
}
