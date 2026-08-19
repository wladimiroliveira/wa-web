import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fromPercent } from "@/features/recipes/margin";
import type { CreateRecipeInput } from "@/features/recipes/recipes.api";
import { useCreateRecipe } from "@/features/recipes/use-recipe-mutations";
import { useSupplies } from "@/features/supplies/use-supplies";
import { isFormError } from "@/lib/form-errors";
import { ApiError } from "@/lib/http";
import { ALL_UNITS, unitLabel } from "@/lib/unit";

/**
 * Mirrors the API's Zod so the error shows before the round trip. The
 * `preprocess` on the two money-ish fields is the trap `z.coerce.number()` sets
 * on its own: `Number("")` is `0`, so an untouched field would silently coerce
 * to free labor and a zero margin instead of failing as unanswered. A typed `0`
 * still passes `nonnegative` untouched — both are legitimate values.
 *
 * The margin is a percentage here and a fraction on the wire; `fromPercent` is
 * the only place that crosses.
 */
const recipeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  batchYield: z.coerce.number().positive("Informe um rendimento maior que zero"),
  laborCostPerHundred: z.preprocess(
    (value) => (value === "" ? NaN : value),
    z.coerce.number({ error: "Informe a mão de obra" }).nonnegative("A mão de obra não pode ser negativa"),
  ),
  marginPercent: z.preprocess(
    (value) => (value === "" ? NaN : value),
    z.coerce.number({ error: "Informe a margem" }).nonnegative("A margem não pode ser negativa"),
  ),
  items: z
    .array(
      z.object({
        supplyId: z.string().uuid("Escolha o insumo"),
        usageQty: z.coerce.number().positive("Informe a quantidade"),
        // The literal tuple, not `ALL_UNITS`: `z.enum` needs a readonly tuple,
        // and `ALL_UNITS` is a `Unit[]`. `SupplyFormPage` spells it out the
        // same way, and `unit.ts` keeps tsc honest if the API adds a unit.
        usageUnit: z.enum(["G", "KG", "ML", "L", "UN"]),
      }),
    )
    .min(1, "Adicione ao menos um insumo"),
});

type RecipeFormInput = z.input<typeof recipeSchema>;
type RecipeFormValues = z.output<typeof recipeSchema>;

function toPayload(values: RecipeFormValues): CreateRecipeInput {
  return {
    name: values.name,
    batchYield: values.batchYield,
    laborCostPerHundred: values.laborCostPerHundred,
    margin: fromPercent(values.marginPercent),
    items: values.items.map((item) => ({
      supplyId: item.supplyId,
      usageQty: item.usageQty,
      usageUnit: item.usageUnit,
    })),
  };
}

interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

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

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível salvar. Verifique sua conexão.";
}

export function RecipeFormPage() {
  const navigate = useNavigate();
  const supplies = useSupplies();
  const createRecipe = useCreateRecipe();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput, unknown, RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { items: [] },
  });

  const items = useFieldArray({ control, name: "items" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await createRecipe.mutateAsync(toPayload(values));
      navigate("/recipes", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError((error as ApiError).message);
      else toast.error(toastMessageFor(error));
    }
  });

  if (supplies.isError) {
    return (
      <section className="p-8">
        <QueryErrorState error={supplies.error} onRetry={() => void supplies.refetch()} />
        <Link to="/recipes" className="mt-4 inline-block text-sm underline">
          Voltar para receitas
        </Link>
      </section>
    );
  }
  if (!supplies.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  // The API needs at least one item, and the select would have nothing in it.
  if (supplies.data.length === 0) {
    return (
      <section className="p-8">
        <PageHeader title="Nova receita" />
        <p className="text-sm text-muted-foreground">Cadastre um insumo antes de criar uma receita.</p>
        <Link to="/supplies/new" className={buttonVariants({ size: "sm", className: "mt-4" })}>
          Cadastrar insumo
        </Link>
      </section>
    );
  }

  return (
    <section className="p-8">
      <PageHeader title="Nova receita" />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />
          <Field
            id="batchYield"
            label="Rendimento do lote (un)"
            type="number"
            step="any"
            error={errors.batchYield?.message}
            {...register("batchYield")}
          />
          <Field
            id="laborCostPerHundred"
            label="Mão de obra por cento"
            type="number"
            step="any"
            error={errors.laborCostPerHundred?.message}
            {...register("laborCostPerHundred")}
          />
          <Field
            id="marginPercent"
            label="Margem (%)"
            type="number"
            step="any"
            error={errors.marginPercent?.message}
            {...register("marginPercent")}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Insumos da receita</legend>

          {items.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              {/* The three row controls are named by `aria-label`, not by a
                  visible `<Label>`: the column headers of a row do not repeat
                  per row, and a screen reader still needs "item 3" said out
                  loud. */}
              <div className="flex-1 space-y-1.5">
                <NativeSelect aria-label={`Insumo do item ${index + 1}`} {...register(`items.${index}.supplyId`)}>
                  <option value="">Escolha o insumo</option>
                  {supplies.data.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.name}
                    </option>
                  ))}
                </NativeSelect>
                {errors.items?.[index]?.supplyId && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.items[index]!.supplyId!.message}
                  </p>
                )}
              </div>

              <div className="w-32 space-y-1.5">
                <Input
                  type="number"
                  step="any"
                  aria-label={`Quantidade do item ${index + 1}`}
                  {...register(`items.${index}.usageQty`)}
                />
                {errors.items?.[index]?.usageQty && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.items[index]!.usageQty!.message}
                  </p>
                )}
              </div>

              <div className="w-24">
                <NativeSelect aria-label={`Unidade do item ${index + 1}`} {...register(`items.${index}.usageUnit`)}>
                  {ALL_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unitLabel(unit)}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover item ${index + 1}`}
                onClick={() => items.remove(index)}
              >
                Remover
              </Button>
            </div>
          ))}

          {/* Removing the last row is not blocked by the button: the schema
              refuses the submission, and the message explains itself. The
              `min(1)` error belongs to the array itself, which react-hook-form
              exposes on `.message` or under `.root` depending on how it was
              set — read both. */}
          {(errors.items?.message ?? errors.items?.root?.message) && (
            <p role="alert" className="text-sm text-destructive">
              {errors.items?.message ?? errors.items?.root?.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => items.append({ supplyId: "", usageQty: "", usageUnit: supplies.data![0].purchaseUnit })}
          >
            Adicionar insumo
          </Button>
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Salvar
          </Button>
          <Link to="/recipes" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
