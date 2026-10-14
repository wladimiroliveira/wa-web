import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { ProductDialog } from "@/features/products/ProductDialog";
import { kindLabel } from "@/features/products/product-kinds";
import { fetchProducts, productsKeys } from "@/features/products/products.api";
import { RecipeDialog } from "@/features/recipes/RecipeDialog";
import type { Product } from "@/lib/api";
import { unitLabel } from "@/lib/units";

export function ProductsListPage() {
  const products = useQuery({ queryKey: productsKeys.all, queryFn: fetchProducts });
  const { can } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [awaitingRecipe, setAwaitingRecipe] = useState<Product | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Produtos</h1>
        {can("CATALOG_CREATE") ? (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            Novo produto
          </Button>
        ) : null}
      </div>

      {products.isPending ? <p>Carregando…</p> : null}

      {products.isError ? <QueryErrorState error={products.error} onRetry={() => void products.refetch()} /> : null}

      {products.isSuccess && products.data.length === 0 ? <p>Nenhum produto cadastrado ainda.</p> : null}

      {products.isSuccess && products.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>GTIN</TableHead>
              <TableHead>Situação</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(product) => {
          // Only a manufactured product has a recipe, and saving one takes its own permission.
          if (product.kind === "MANUFACTURED" && can("CATALOG_UPDATE")) setAwaitingRecipe(product);
        }}
      />

      <RecipeDialog product={awaitingRecipe} onClose={() => setAwaitingRecipe(null)} />
    </div>
  );
}
