import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createEntry } from "@/features/entries/entries.api";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import type { Entry } from "@/lib/api";
import { formatDecimal, formatMoney, isDecimalInput, toApiDecimal } from "@/lib/decimal";
import { messageForError } from "@/lib/form-errors";
import { unitLabel } from "@/lib/units";

const entryFormSchema = z.object({
  productSku: z.string().min(1, "Escolha o produto."),
  quantity: z
    .string()
    .refine(isDecimalInput, "Informe a quantidade, com até 6 casas decimais.")
    .refine((typed) => Number(toApiDecimal(typed)) > 0, "A quantidade deve ser maior que zero."),
  unitCost: z.string().refine(isDecimalInput, "Informe o custo unitário, com até 6 casas decimais."),
});

type EntryForm = z.infer<typeof entryFormSchema>;

const EMPTY_FORM: EntryForm = { productSku: "", quantity: "", unitCost: "" };

const SAVE_MESSAGES = {
  404: "Esse produto já não existe mais. Atualize a página.",
  409: "Esse produto está inativo e não recebe entradas.",
};

export function EntryPage() {
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts });
  const [failure, setFailure] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Entry | null>(null);

  const form = useForm<EntryForm>({ resolver: zodResolver(entryFormSchema), defaultValues: EMPTY_FORM });

  const save = useMutation({
    mutationFn: (values: EntryForm) =>
      createEntry({
        productSku: values.productSku,
        quantity: toApiDecimal(values.quantity),
        unitCost: toApiDecimal(values.unitCost),
      }),
    onSuccess: (entry) => {
      setRecorded(entry);
      toast.success("Entrada lançada.");
      form.reset(EMPTY_FORM);
    },
    onError: (error: unknown) => setFailure(messageForError(error, SAVE_MESSAGES)),
  });

  // An inactive product is refused by the API, so it is never offered.
  const active = products.data?.filter((product) => product.isActive) ?? [];

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-semibold">Entradas</h1>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && active.length === 0 ? <p>Nenhum produto ativo cadastrado.</p> : null}

      {products.isSuccess && active.length > 0 ? (
        <form
          onSubmit={form.handleSubmit((values) => {
            setFailure(null);
            save.mutate(values);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-product">Produto</Label>
            <NativeSelect id="entry-product" {...form.register("productSku")}>
              <option value="">Selecione um produto</option>
              {active.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {product.description} ({unitLabel(product.unit)})
                </option>
              ))}
            </NativeSelect>
            {form.formState.errors.productSku ? (
              <p className="text-sm text-destructive">{form.formState.errors.productSku.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-quantity">Quantidade</Label>
            <Input id="entry-quantity" inputMode="decimal" autoComplete="off" {...form.register("quantity")} />
            {form.formState.errors.quantity ? (
              <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-unit-cost">Custo unitário</Label>
            <Input id="entry-unit-cost" inputMode="decimal" autoComplete="off" {...form.register("unitCost")} />
            {form.formState.errors.unitCost ? (
              <p className="text-sm text-destructive">{form.formState.errors.unitCost.message}</p>
            ) : null}
          </div>

          {failure !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          <Button type="submit" disabled={save.isPending} className="self-start">
            Lançar entrada
          </Button>
        </form>
      ) : null}

      {recorded !== null ? (
        <div role="status" className="flex flex-col gap-3 rounded-md border p-4">
          <p className="font-medium">
            Entrada lançada: {formatDecimal(recorded.quantity)} {unitLabel(recorded.product.unit)} de{" "}
            {recorded.product.description}.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Estoque atual</dt>
            <dd>
              {formatDecimal(recorded.stock.quantity)} {unitLabel(recorded.product.unit)}
            </dd>
            <dt className="text-muted-foreground">Último custo</dt>
            <dd>{formatMoney(recorded.stock.lastEntryCost)}</dd>
            <dt className="text-muted-foreground">Custo médio</dt>
            <dd>{formatMoney(recorded.stock.averageCost)}</dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
