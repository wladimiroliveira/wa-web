import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentProps, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SUPPLY_TYPE_LABELS } from "@/features/supplies/supply-labels";
import { useCreateSupply, useUpdateSupply } from "@/features/supplies/use-supply-mutations";
import { useSupply } from "@/features/supplies/use-supply";
import { isFormError } from "@/lib/form-errors";
import { ApiError } from "@/lib/http";
import { ALL_UNITS, unitLabel } from "@/lib/unit";

/**
 * Mirrors the API's Zod so the error shows before the round trip:
 * `purchaseQty` is positive, `purchasePrice` is non-negative — free is valid.
 *
 * `purchasePrice` also guards against a trap `z.coerce.number()` sets on its
 * own: `Number("")` is `0`, so an untouched field would silently coerce to a
 * free supply instead of failing as unanswered. The preprocess step turns the
 * empty string into `NaN` first, which `z.coerce.number()` rejects as the
 * wrong type — so blank fails as missing, and a typed `0` still passes
 * `nonnegative` untouched.
 */
const supplySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  type: z.enum(["INGREDIENT", "PACKAGING"]),
  purchaseUnit: z.enum(["G", "KG", "ML", "L", "UN"]),
  purchaseQty: z.coerce.number().positive("Informe uma quantidade maior que zero"),
  purchasePrice: z.preprocess(
    (value) => (value === "" ? NaN : value),
    z.coerce.number({ error: "Informe o preço" }).nonnegative("O preço não pode ser negativo"),
  ),
});

type SupplyForm = z.infer<typeof supplySchema>;

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

export function SupplyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const supply = useSupply(id);
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply(id ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplyForm>({
    resolver: zodResolver(supplySchema),
    defaultValues: { type: "INGREDIENT", purchaseUnit: "KG" },
  });

  // Seeds the form once the API answers. `reset`, not `setValue`, so the fields
  // also stop counting as dirty.
  useEffect(() => {
    if (!isEditing || !supply.data) return;
    reset({
      name: supply.data.name,
      type: supply.data.type,
      purchaseUnit: supply.data.purchaseUnit,
      purchaseQty: supply.data.purchaseQty,
      purchasePrice: supply.data.purchasePrice,
    });
  }, [isEditing, supply.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      if (isEditing) await updateSupply.mutateAsync(values);
      else await createSupply.mutateAsync(values);
      navigate("/supplies", { replace: true });
    } catch (error) {
      if (isFormError(error)) setFormError((error as ApiError).message);
      else toast.error(toastMessageFor(error));
    }
  });

  if (supply.isError) {
    return (
      <section className="p-8">
        <QueryErrorState error={supply.error} onRetry={() => void supply.refetch()} />
        <Link to="/supplies" className="mt-4 inline-block text-sm underline">
          Voltar para insumos
        </Link>
      </section>
    );
  }
  if (isEditing && !supply.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={isEditing ? supply.data!.name : "Novo insumo"} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Nome" error={errors.name?.message} {...register("name")} />

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo</Label>
            <NativeSelect id="type" {...register("type")}>
              {(Object.keys(SUPPLY_TYPE_LABELS) as (keyof typeof SUPPLY_TYPE_LABELS)[]).map((type) => (
                <option key={type} value={type}>
                  {SUPPLY_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchaseUnit">Unidade de compra</Label>
            {/* All five: here the choice IS the declaration of the supply's
                dimension, so there is no prior dimension to respect. */}
            <NativeSelect id="purchaseUnit" {...register("purchaseUnit")}>
              {ALL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabel(unit)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <Field
            id="purchaseQty"
            label="Quantidade comprada"
            type="number"
            step="any"
            error={errors.purchaseQty?.message}
            {...register("purchaseQty")}
          />
          <Field
            id="purchasePrice"
            label="Preço de compra"
            type="number"
            step="any"
            error={errors.purchasePrice?.message}
            {...register("purchasePrice")}
          />
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
          <Link to="/supplies" className={buttonVariants({ variant: "ghost" })}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
