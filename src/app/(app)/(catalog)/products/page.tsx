"use client";

import { Suspense } from "react";
import { ProductsListPage } from "@/features/products/ProductsListPage";

// The screen keeps its filters in the query string, which is only known in the browser.
export default function Page() {
  return (
    <Suspense>
      <ProductsListPage />
    </Suspense>
  );
}
