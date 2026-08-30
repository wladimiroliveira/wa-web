import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/form-errors";

interface QueryErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/** A screen is always loading, showing data, or showing this. Never blank. */
export function QueryErrorState({ error, onRetry }: QueryErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 p-4">
      <p>{messageForError(error)}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
