import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword } from "@/features/auth/auth.api";
import { useSession } from "@/features/auth/use-session";
import { messageForError } from "@/lib/form-errors";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres."),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ["confirmation"],
    message: "As senhas não conferem.",
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const CHANGE_MESSAGES = { 401: "A senha atual não confere." };

export function ChangePasswordPage() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure(null);

    try {
      await changeOwnPassword({ currentPassword, newPassword });

      // The API revokes every refresh token on a password change, this session's
      // included. Ending it here is telling the truth; waiting for the next call
      // to fail would drop the operator at the sign-in screen with no reason given.
      await signOut();
      toast.success("Senha trocada. Entre de novo com a senha nova.");
      navigate("/login", { replace: true });
    } catch (error) {
      setFailure(messageForError(error, CHANGE_MESSAGES));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-xl font-semibold">Trocar a senha</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
          {form.formState.errors.currentPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
          {form.formState.errors.newPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation">Repita a nova senha</Label>
          <Input id="confirmation" type="password" autoComplete="new-password" {...form.register("confirmation")} />
          {form.formState.errors.confirmation ? (
            <p className="text-sm text-destructive">{form.formState.errors.confirmation.message}</p>
          ) : null}
        </div>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Trocar a senha
        </Button>
      </form>
    </div>
  );
}
