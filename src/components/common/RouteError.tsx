import { Link, useRouteError } from "react-router-dom";
import { ApiError } from "@/lib/http";

/**
 * Last resort for anything thrown during render. Query failures do not land
 * here — they are rendered inline by {@link QueryErrorState}, which is where a
 * retry button can still do something.
 */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof ApiError ? error.message : "Algo deu errado nesta tela.";

  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Voltar para o início
      </Link>
    </section>
  );
}
