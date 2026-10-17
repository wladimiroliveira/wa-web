import { useCallback, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FacetChoice, FacetFilter } from "@/components/common/FacetFilter";
import { RowActions, RowActionsItem } from "@/components/common/RowActions";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { SearchField } from "@/components/common/SearchField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  // The address holds the filters. Each change replaces the entry instead of stacking one per
  // keystroke, so the back button leaves the screen rather than undoing a letter.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readProductFilters(searchParams);
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

  const changeFilters = useCallback(
    (change: (params: URLSearchParams) => URLSearchParams) => setSearchParams(change, { replace: true }),
    [setSearchParams],
  );
  const search = useCallback((q: string) => changeFilters((params) => withValues(params, "q", [q])), [changeFilters]);
  const clearFilters = () => changeFilters(withoutProductFilters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageTitle>Produtos</PageTitle>
        {can("CATALOG_CREATE") ? (
          <Button type="button" onClick={() => openFor(null)}>
            Novo produto
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          label="Buscar produtos"
          placeholder="Buscar por descrição ou GTIN"
          value={filters.q ?? ""}
          onSearch={search}
        />
        <FacetFilter
          label="Tipo"
          options={KIND_OPTIONS}
          selected={filters.kind ?? []}
          onChange={(kinds) => changeFilters((params) => withValues(params, "kind", kinds))}
        />
        <FacetFilter
          label="Unidade"
          options={UNIT_OPTIONS}
          selected={filters.unit ?? []}
          onChange={(units) => changeFilters((params) => withValues(params, "unit", units))}
        />
        <FacetChoice
          label="Situação"
          options={STATUS_OPTIONS}
          value={readStatusChoice(searchParams)}
          onChange={(choice) => changeFilters((params) => withStatusChoice(params, choice))}
        />
        {filtered ? (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && products.data.length === 0 && !filtered ? <p>Nenhum produto ativo.</p> : null}

      {products.isSuccess && products.data.length === 0 && filtered ? (
        <div className="flex flex-col items-start gap-3">
          <p>Nenhum produto encontrado para estes filtros.</p>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : null}

      {products.isSuccess && products.data.length > 0 ? (
        <div className="flex flex-col gap-2" aria-busy={products.isPlaceholderData}>
          <p className="text-sm text-muted-foreground">
            {products.data.length} {products.data.length === 1 ? "produto" : "produtos"}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>GTIN</TableHead>
                <TableHead>Situação</TableHead>
                {canEdit ? <TableHead>Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.map((product) => (
                <TableRow key={product.sku}>
                  <TableCell>{product.description}</TableCell>
                  <TableCell>{kindLabel(product.kind)}</TableCell>
                  <TableCell>{unitLabel(product.unit)}</TableCell>
                  <TableCell>{product.gtin ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "secondary" : "outline"}>
                      {product.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <RowActions label={`Ações de ${product.description}`}>
                        <RowActionsItem onClick={() => openFor(product)}>Editar</RowActionsItem>
                        <RowActionsItem disabled={toggle.isPending} onClick={() => toggle.mutate(product)}>
                          {product.isActive ? "Inativar" : "Reativar"}
                        </RowActionsItem>
                      </RowActions>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
