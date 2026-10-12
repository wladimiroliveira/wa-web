import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupplier, suppliersKeys } from "@/features/suppliers/suppliers.api";
import { messageForError } from "@/lib/form-errors";

const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do fornecedor.").max(120, "O nome pode ter no máximo 120 caracteres."),
});

type SupplierForm = z.infer<typeof supplierFormSchema>;

const EMPTY_FORM: SupplierForm = { name: "" };

const SAVE_MESSAGES = {
  409: "Já existe um fornecedor com esse nome.",
};

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierDialog({ open, onOpenChange }: SupplierDialogProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<SupplierForm>({ resolver: zodResolver(supplierFormSchema), defaultValues: EMPTY_FORM });

  // Reopening the dialog must not show what was typed for the previous supplier;
  // the form is only constructed once.
  useEffect(() => {
    form.reset(EMPTY_FORM);
    setFailure(null);
  }, [form, open]);

  const save = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: suppliersKeys.all });
      toast.success("Fornecedor cadastrado.");
      onOpenChange(false);
    },
    onError: (error: unknown) => setFailure(messageForError(error, SAVE_MESSAGES)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((values) => {
            setFailure(null);
            save.mutate(values);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-name">Nome</Label>
            <Input id="supplier-name" autoFocus autoComplete="off" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          {failure !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
