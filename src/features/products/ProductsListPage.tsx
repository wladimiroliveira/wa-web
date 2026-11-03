import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FacetChoice, FacetFilter } from "@/components/common/FacetFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterPanel } from "@/components/common/FilterPanel";
import { IconButton } from "@/components/common/IconButton";
import { RowActions, RowActionsItem } from "@/components/common/RowActions";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { SearchField } from "@/components/common/SearchField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/use-session";
import { ProductDialog } from "@/features/products/ProductDialog";
import {
  hasProductFilters,
  readProductFilters,
  readStatusChoice,
  STATUS_CHOICES,
  statusLabel,
  withoutProductFilters,
  withStatusChoice,
} from "@/features/products/product-filters";
import { kindLabel, PRODUCT_KINDS } from "@/features/products/product-kinds";
import { productsKeys, searchProducts, updateProduct } from "@/features/products/products.api";
import { RecipeDialog } from "@/features/recipes/RecipeDialog";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import type { Product } from "@/lib/api";
import { messageForError } from "@/lib/form-errors";
import { UNITS, unitLabel, unitName } from "@/lib/units";
import { withValues } from "@/lib/url-filters";
import { PageTitle } from "@/components/layout/PageTitle";

const KIND_OPTIONS = PRODUCT_KINDS.map((kind) => ({ value: kind, label: kindLabel(kind) }));
const UNIT_OPTIONS = UNITS.map((unit) => ({ value: unit, label: unitName(unit) }));
const STATUS_OPTIONS = STATUS_CHOICES.map((choice) => ({ value: choice, label: statusLabel(choice) }));

export function ProductsListPage() {
  const queryClient = useQueryClient();
  // The address holds the filters in effect; the panel edits a draft of them until Consultar runs it.
  // Running replaces the entry, so the back button leaves the screen rather than undoing a query.
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState(searchParams);
  const filters = readProductFilters(searchParams);
  const drafted = readProductFilters(draft);
  const filtered = hasProductFilters(searchParams);
  const products = useQuery({
    queryKey: productsKeys.list(filters),
    queryFn: () => searchProducts(filters),
    // The rows of the last answer stay on screen while the next one loads, instead of a flash of "Carregando…".
    placeholderData: keepPreviousData,
  });
  const { can } = useSession();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [awaitingRecipe, setAwaitingRecipe] = useState<Product | null>(null);
  const canCreate = can("CATALOG_CREATE");
  const canEdit = can("CATALOG_UPDATE");

  // A product is never deleted: its movements and recipes still refer to it. Out of use, it only
  // stops being offered where a new record would take it.
  const toggle = useMutation({
    mutationFn: (product: Product) => updateProduct(product.sku, { isActive: !product.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKeys.all }),
    onError: (error: unknown) => toast.error(messageForError(error)),
  });

  function openFor(product: Product | null): void {
    setEditing(product);
    setDialogOpen(true);
  }

  // The draft follows the address when it changes from outside, as on a link or the back button.
  useEffect(() => setDraft(searchParams), [searchParams]);

  // Running the filters already in effect asks the API again, so Consultar always brings fresh rows.
  function runQuery(): void {
    if (draft.toString() === searchParams.toString()) void products.refetch();
    else setSearchParams(draft, { replace: true });
  }

  // Clearing runs at once: the plain list is what the screen opens with.
  function clearFilters(): void {
    const cleared = withoutProductFilters(searchParams);

    setDraft(cleared);
    setSearchParams(cleared, { replace: true });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageTitle>Produtos</PageTitle>

      <FilterPanel
        label="Filtrar produtos"
        onSubmit={runQuery}
        onClear={filtered || hasProductFilters(draft) ? clearFilters : undefined}
      >
        <SearchField
          label="Buscar produtos"
          placeholder="Buscar por descrição ou GTIN"
          // The draft as typed, untrimmed, so a space between two words survives until the next one.
          value={draft.get("q") ?? ""}
          onChange={(q) => setDraft((params) => withValues(params, "q", [q]))}
        />
        <FacetFilter
          label="Tipo"
          options={KIND_OPTIONS}
          selected={drafted.kind ?? []}
          onChange={(kinds) => setDraft((params) => withValues(params, "kind", kinds))}
        />
        <FacetFilter
          label="Unidade"
          options={UNIT_OPTIONS}
          selected={drafted.unit ?? []}
          onChange={(units) => setDraft((params) => withValues(params, "unit", units))}
        />
        <FacetChoice
          label="Situação"
          options={STATUS_OPTIONS}
          value={readStatusChoice(draft)}
          onChange={(choice) => setDraft((params) => withStatusChoice(params, choice))}
        />
      </FilterPanel>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && products.data.length === 0 ? (
        <EmptyState
          actions={
            filtered || canCreate ? (
              <>
                {filtered ? (
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button type="button" variant="outline" onClick={() => openFor(null)}>
                    Novo produto
                  </Button>
                ) : null}
              </>
            ) : null
          }
        >
          {filtered ? "Nenhum produto encontrado para estes filtros." : "Nenhum produto ativo."}
        </EmptyState>
      ) : null}

      {products.isSuccess && products.data.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2" aria-busy={products.isPlaceholderData}>
          <ArrangeableTable
            tableKey="products"
            rowNoun={{ one: "produto", other: "produtos" }}
            fill
            rows={products.data}
            rowKey={(product) => product.sku}
            actions={
              canCreate ? (
                <IconButton label="Novo produto" variant="default" onClick={() => openFor(null)}>
                  <PlusIcon aria-hidden="true" />
                </IconButton>
              ) : null
            }
            columns={[
              { key: "description", header: "Descrição", cell: (product) => product.description },
              { key: "kind", header: "Tipo", cell: (product) => kindLabel(product.kind) },
              { key: "unit", header: "Unidade", cell: (product) => unitLabel(product.unit) },
              { key: "gtin", header: "GTIN", cell: (product) => product.gtin ?? "—" },
              {
                key: "status",
                header: "Situação",
                cell: (product) => (
                  <Badge variant={product.isActive ? "secondary" : "outline"}>
                    {product.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                ),
              },
              ...(canEdit
                ? [
                    {
                      key: "actions",
                      header: "Ações",
                      cell: (product: Product) => (
                        <RowActions label={`Ações de ${product.description}`}>
                          <RowActionsItem onClick={() => openFor(product)}>Editar</RowActionsItem>
                          <RowActionsItem disabled={toggle.isPending} onClick={() => toggle.mutate(product)}>
                            {product.isActive ? "Inativar" : "Reativar"}
                          </RowActionsItem>
                        </RowActions>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ) : null}

      <ProductDialog
        product={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(product) => {
          // Only a manufactured product has a recipe, and saving one takes its own permission.
          if (product.kind === "MANUFACTURED" && canEdit) setAwaitingRecipe(product);
        }}
      />

      <RecipeDialog product={awaitingRecipe} onClose={() => setAwaitingRecipe(null)} />
    </div>
  );
}
