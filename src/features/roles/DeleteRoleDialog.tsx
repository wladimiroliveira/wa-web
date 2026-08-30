import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteRole, rolesKeys } from "@/features/roles/roles.api";
import type { Role } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { messageForError } from "@/lib/form-errors";

interface DeleteRoleDialogProps {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({ role, onOpenChange }: DeleteRoleDialogProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      toast.success("Papel excluído.");
      onOpenChange(false);
    },
    onError: async (error: unknown) => {
      // Someone else deleted it first. The operator asked for it gone and it is
      // gone: that is the outcome they wanted, not an error to explain.
      if (error instanceof ApiError && error.status === 404) {
        await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
        toast.success("Esse papel já havia sido excluído.");
        onOpenChange(false);
        return;
      }

      setFailure(messageForError(error));
    },
  });

  return (
    <AlertDialog
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) setFailure(null);
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Excluir o papel "${role?.name ?? ""}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Quem tiver esse papel fica sem as permissões que ele dava. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {failure !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Defensive, not load-bearing: this kit's `AlertDialogAction` is a plain
              // Button with no dismiss behaviour of its own, and what opens or closes this
              // dialog is `role !== null` alone. The call stays so a future kit swap, or
              // moving this into a form, cannot turn a failed delete into a dialog that
              // closes and leaves the operator unsure whether it worked.
              event.preventDefault();
              setFailure(null);
              if (role !== null) remove.mutate(role.id);
            }}
            disabled={remove.isPending}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
