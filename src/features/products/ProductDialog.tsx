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
import { NativeSelect } from "@/components/ui/native-select";
import { kindLabel, PRODUCT_KINDS } from "@/features/products/product-kinds";
import { createProduct, productsKeys } from "@/features/products/products.api";
import type { Product } from "@/lib/api";
import { messageForError } from "@/lib/form-errors";
import { unitName, UNITS } from "@/lib/units";

const productFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe a descrição do produto.")
    .max(120, "A descrição pode ter no máximo 120 caracteres."),
  kind: z.enum(PRODUCT_KINDS, "Escolha o tipo."),
  unit: z.enum(UNITS, "Escolha a unidade."),
  gtin: z
    .string()
    .trim()
    .refine((typed) => typed === "" || /^\d{8,14}$/.test(typed), "O GTIN tem de 8 a 14 dígitos, só números."),
});

type ProductFormInput = z.input<typeof productFormSchema>;
type ProductForm = z.output<typeof productFormSchema>;

// Kind and unit start unset on purpose: the operator chooses them, nothing is assumed.
const EMPTY_FORM = { description: "", gtin: "" };

const SAVE_MESSAGES = {
  409: "Já existe um produto com essa descrição ou com esse GTIN.",
};

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (product: Product) => void;
}

export function ProductDialog({ open, onOpenChange, onCreated }: ProductDialogProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<ProductFormInput, unknown, ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: EMPTY_FORM,
  });

  // Reopening the dialog must not show what was typed for the previous product;
  // the form is only constructed once.
  useEffect(() => {
    form.reset(EMPTY_FORM);
    setFailure(null);
  }, [form, open]);

  const save = useMutation({
    mutationFn: ({ gtin, ...product }: ProductForm) => createProduct(gtin === "" ? product : { ...product, gtin }),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: productsKeys.all });
      toast.success("Produto cadastrado.");
      onOpenChange(false);
      onCreated?.(product);
    },
    onError: (error: unknown) => setFailure(messageForError(error, SAVE_MESSAGES)),
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
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
            <Label htmlFor="product-description">Descrição</Label>
            <Input id="product-description" autoFocus autoComplete="off" {...form.register("description")} />
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="product-kind">Tipo</Label>
            <NativeSelect id="product-kind" {...form.register("kind")}>
              <option value="">Selecione o tipo</option>
              {PRODUCT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabel(kind)}
                </option>
              ))}
            </NativeSelect>
            {errors.kind ? <p className="text-sm text-destructive">{errors.kind.message}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="product-unit">Unidade</Label>
            <NativeSelect id="product-unit" {...form.register("unit")}>
              <option value="">Selecione a unidade</option>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitName(unit)}
                </option>
              ))}
            </NativeSelect>
            {errors.unit ? <p className="text-sm text-destructive">{errors.unit.message}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="product-gtin">GTIN (opcional)</Label>
            <Input id="product-gtin" inputMode="numeric" autoComplete="off" {...form.register("gtin")} />
            {errors.gtin ? <p className="text-sm text-destructive">{errors.gtin.message}</p> : null}
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
