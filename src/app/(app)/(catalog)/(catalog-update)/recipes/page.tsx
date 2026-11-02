"use client";

import { Suspense } from "react";
import { RecipesListPage } from "@/features/recipes/RecipesListPage";

// The screen keeps its filters in the query string, which is only known in the browser.
export default function Page() {
  return (
    <Suspense>
      <RecipesListPage />
    </Suspense>
  );
}
