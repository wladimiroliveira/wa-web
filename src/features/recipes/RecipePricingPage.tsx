import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { toPercent } from "@/features/recipes/margin";
import { useRecipe } from "@/features/recipes/use-recipe";
import { useRecipePricing } from "@/features/recipes/use-recipe-pricing";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ApiError } from "@/lib/http";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between border-b py-2 ${strong ? "text-lg font-semibold" : ""}`}>
      <span className={strong ? "" : "text-sm text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function RecipePricingPage() {
  const { id } = useParams<{ id: string }>();
  const recipe = useRecipe(id);
  const pricing = useRecipePricing(id);

  const notFound =
    (recipe.error instanceof ApiError && recipe.error.status === 404) ||
    (pricing.error instanceof ApiError && pricing.error.status === 404);

  if (notFound) {
    return (
      <section className="p-8">
        <p role="alert" className="text-sm">
          Receita não encontrada.
        </p>
        <Link to="/recipes" className="mt-4 inline-block text-sm underline">
          Voltar para receitas
        </Link>
      </section>
    );
  }

  /**
   * The 409 the pricing route answers with is `DIMENSION_MISMATCH`, and the form
   * makes it impossible to create — but not impossible to happen. Editing a
   * supply afterwards, from KG to L, rots a recipe that was saved valid. The
   * fix is one screen away, and the link is the whole point of the message.
   */
  if (pricing.error instanceof ApiError && pricing.error.status === 409) {
    return (
      <section className="p-8">
        <p role="alert" className="text-sm">
          Um insumo desta receita mudou para uma unidade de outra dimensão.{" "}
          <Link to={`/recipes/${id}`} className="underline">
            Editar a receita
          </Link>{" "}
          para calcular o preço.
        </p>
      </section>
    );
  }

  if (recipe.isError) return <QueryErrorState error={recipe.error} onRetry={() => void recipe.refetch()} />;
  if (pricing.isError) return <QueryErrorState error={pricing.error} onRetry={() => void pricing.refetch()} />;
  if (!recipe.data || !pricing.data) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <section className="p-8">
      <PageHeader title={recipe.data.name}>
        <Link to="/recipes" className="text-sm underline">
          Voltar para receitas
        </Link>
      </PageHeader>

      <div className="max-w-md">
        <Row label="Insumos / cento" value={formatCurrency(pricing.data.suppliesCostPerHundred)} />
        {/* Labor comes from the recipe: subtracting the two costs would reach
            the same number by inventing a calculation the API already did. */}
        <Row label="Mão de obra / cento" value={formatCurrency(recipe.data.laborCostPerHundred)} />
        <Row label="Custo total / cento" value={formatCurrency(pricing.data.totalCostPerHundred)} />
        <Row label="Margem" value={`${formatQuantity(toPercent(recipe.data.margin))} %`} />
        {/* The exact price sits next to the hundred on purpose: it is where the
            round up to the whole real becomes visible. */}
        <Row label="Preço exato" value={formatCurrency(pricing.data.exactPrice)} />
        <Row label="Cento" value={formatCurrency(pricing.data.pricePerHundred)} strong />
        <Row label="Meio cento" value={formatCurrency(pricing.data.pricePerHalfHundred)} strong />
      </div>
    </section>
  );
}
