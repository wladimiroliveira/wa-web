import { useState } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericInput } from "@/components/ui/numeric-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createPreWeighing,
  fetchPreWeighingPlan,
  preWeighingsKeys,
  type PreWeighingTarget,
} from "@/features/pre-weighings/pre-weighings.api";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { quantityOf } from "@/features/stock/stock-format";
import type { PreWeighing, PreWeighingPlan } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { toApiDecimal } from "@/lib/decimal";
import { messageForError } from "@/lib/form-errors";
import { positiveDecimal } from "@/lib/form-schemas";
import { ApiError } from "@/lib/http";
import { unitLabel } from "@/lib/units";
import { PageTitle } from "@/components/layout/PageTitle";

const targetFormSchema = z.object({
  productSku: z.string().min(1, "Escolha o produto."),
  quantity: positiveDecimal("Informe a quantidade, com até 6 casas decimais.", "A quantidade deve ser maior que zero."),
});

type TargetForm = z.infer<typeof targetFormSchema>;

const EMPTY_TARGET: TargetForm = { productSku: "", quantity: "" };

// One per ingredient of the plan, in the order of the plan.
const weighingFormSchema = z.object({
  items: z.array(
    z.object({
      weighedQuantity: positiveDecimal(
        "Informe o pesado, com até 6 casas decimais.",
        "O pesado deve ser maior que zero.",
      ),
    }),
  ),
});

type WeighingFormValues = z.infer<typeof weighingFormSchema>;

// Every refusal of the plan is the API having decided, so none of them is worth trying again as it is.
const PLAN_MESSAGES = {
  404: "Esse produto não existe mais. Atualize a página.",
  409: "Não foi possível calcular: o produto não tem receita, a receita usa um produto inativo ou a quantidade está fora do que a receita alcança.",
};

const SAVE_MESSAGES = {
  404: "Esse produto não existe mais. Atualize a página.",
  409: "A receita ou o produto mudou desde que o plano foi calculado. Calcule de novo.",
};

interface WeighingFormProps {
  target: PreWeighingTarget;
  plan: PreWeighingPlan;
  onRecorded: (preWeighing: PreWeighing) => void;
}

function WeighingForm({ target, plan, onRecorded }: WeighingFormProps) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm<WeighingFormValues>({
    resolver: zodResolver(weighingFormSchema),
    // Blank on purpose: what gets recorded is what the scale showed, never the plan left untouched.
    defaultValues: { items: plan.items.map(() => ({ weighedQuantity: "" })) },
  });

  const save = useMutation({
    mutationFn: createPreWeighing,
    onSuccess: async (preWeighing) => {
      await queryClient.invalidateQueries({ queryKey: preWeighingsKeys.list() });
      toast.success("Pré-pesagem registrada.");
      onRecorded(preWeighing);
    },
    onError: (error: unknown) => setFailure(messageForError(error, SAVE_MESSAGES)),
  });

  const { errors } = form.formState;

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        setFailure(null);
        save.mutate({
          ...target,
          items: plan.items.map(({ product }, index) => ({
            productSku: product.sku,
            weighedQuantity: toApiDecimal(values.items[index]!.weighedQuantity),
          })),
        });
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      <h2 className="text-lg font-semibold">
        Plano para {quantityOf(plan.quantity, plan.product.unit)} de {plan.product.description}
      </h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Planejado</TableHead>
            <TableHead>Lotes sugeridos</TableHead>
            <TableHead>Pesado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.items.map(({ product, plannedQuantity, lots, shortfall }, index) => (
            <TableRow key={product.sku}>
              <TableCell>{product.description}</TableCell>
              <TableCell>{quantityOf(plannedQuantity, product.unit)}</TableCell>
              <TableCell>
                {lots.length === 0 ? (
                  <p>Nenhum lote com saldo</p>
                ) : (
                  <ul>
                    {lots.map((lot) => (
                      <li key={lot.id}>
                        {quantityOf(lot.quantity, product.unit)} —{" "}
                        {lot.expiresAt === null ? "sem validade" : `validade ${formatDate(lot.expiresAt)}`}
                      </li>
                    ))}
                  </ul>
                )}
                {/* A warning, not a lock: the API records a pre-weighing the stock does not cover. */}
                {Number(shortfall) > 0 ? (
                  <p className="font-medium text-destructive">Faltam {quantityOf(shortfall, product.unit)}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <NumericInput
                    aria-label={`Pesado de ${product.description}`}
                    className="w-32"
                    {...form.register(`items.${index}.weighedQuantity`)}
                  />
                  <span>{unitLabel(product.unit)}</span>
                </div>
                {errors.items?.[index]?.weighedQuantity ? (
                  <p className="text-sm text-destructive">{errors.items[index].weighedQuantity.message}</p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {failure !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}

      <Button type="submit" disabled={save.isPending} className="self-start">
        Registrar pré-pesagem
      </Button>
    </form>
  );
}

export function PreWeighingPage() {
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts });
  const [target, setTarget] = useState<PreWeighingTarget | null>(null);
  // Counts the times the plan was asked for: each one starts the weighing over.
  const [round, setRound] = useState(0);
  const [recorded, setRecorded] = useState<PreWeighing | null>(null);

  const form = useForm<TargetForm>({ resolver: zodResolver(targetFormSchema), defaultValues: EMPTY_TARGET });

  const plan = useQuery({
    queryKey: preWeighingsKeys.plan(target),
    queryFn: target === null ? skipToken : () => fetchPreWeighingPlan(target),
    // The lots come from the stock as it stands, so a plan is never reused from the cache, and it
    // only changes when the operator asks: a refetch behind their back would move the rows they
    // are typing into.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnReconnect: false,
  });

  // Only a manufactured product has a recipe, and an inactive one is refused by the API.
  const offered = products.data?.filter((product) => product.isActive && product.kind === "MANUFACTURED") ?? [];

  const refused = plan.error instanceof ApiError && (plan.error.status === 404 || plan.error.status === 409);
  const { errors } = form.formState;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/pre-weighings" className="flex min-h-11 items-center self-start text-sm underline underline-offset-4">
        Voltar para as pré-pesagens
      </Link>

      <PageTitle>Nova pré-pesagem</PageTitle>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && offered.length === 0 ? <p>Nenhum produto fabricado ativo cadastrado.</p> : null}

      {products.isSuccess && offered.length > 0 ? (
        <form
          onSubmit={form.handleSubmit((values) => {
            const next = { productSku: values.productSku, quantity: toApiDecimal(values.quantity) };
            const same = target?.productSku === next.productSku && target.quantity === next.quantity;

            setRecorded(null);
            setRound((current) => current + 1);
            setTarget(next);
            if (same) void plan.refetch();
          })}
          className="flex max-w-md flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="pre-weighing-product">Produto</Label>
            <NativeSelect id="pre-weighing-product" {...form.register("productSku")}>
              <option value="">Selecione um produto</option>
              {offered.map((product) => (
                <option key={product.sku} value={product.sku}>
                  {product.description} ({unitLabel(product.unit)})
                </option>
              ))}
            </NativeSelect>
            {errors.productSku ? <p className="text-sm text-destructive">{errors.productSku.message}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pre-weighing-quantity">Quantidade a produzir</Label>
            <NumericInput id="pre-weighing-quantity" {...form.register("quantity")} />
            {errors.quantity ? <p className="text-sm text-destructive">{errors.quantity.message}</p> : null}
          </div>

          <Button type="submit" variant="outline" disabled={plan.isFetching} className="self-start">
            Calcular
          </Button>
        </form>
      ) : null}

      {plan.isLoading ? <p>Calculando…</p> : null}

      {plan.isError && refused ? (
        <p role="alert" className="text-sm text-destructive">
          {messageForError(plan.error, PLAN_MESSAGES)}
        </p>
      ) : null}

      {plan.isError && !refused ? <QueryErrorState error={plan.error} onRetry={() => void plan.refetch()} /> : null}

      {target !== null && plan.isSuccess ? (
        <WeighingForm
          key={round}
          target={target}
          plan={plan.data}
          onRecorded={(preWeighing) => {
            setRecorded(preWeighing);
            setTarget(null);
            form.reset(EMPTY_TARGET);
          }}
        />
      ) : null}

      {recorded !== null ? (
        <div role="status" className="flex max-w-md flex-col gap-3 rounded-md border p-4">
          <p className="font-medium">
            Pré-pesagem registrada: {quantityOf(recorded.quantity, recorded.product.unit)} de{" "}
            {recorded.product.description}.
          </p>
          <Link
            to={`/pre-weighings/${recorded.id}`}
            className="flex min-h-11 items-center self-start underline underline-offset-4"
          >
            Ver a pré-pesagem
          </Link>
        </div>
      ) : null}
    </div>
  );
}
