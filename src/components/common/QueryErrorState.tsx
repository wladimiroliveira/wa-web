import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";

interface QueryErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * The recoverable failure — API down, network gone, 500 — rendered where the
 * retry can actually work. A route `errorElement` cannot offer this: React
 * Router has no way to reset its error boundary without navigating.
 */
export function QueryErrorState({ error, onRetry }: QueryErrorStateProps) {
  const message = error instanceof ApiError ? error.message : "Não foi possível carregar. Verifique sua conexão.";

  return (
    <div role="alert" className="rounded-lg border border-destructive/40 p-6">
      <p className="text-sm">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
