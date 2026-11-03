import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/form-errors";

/** Keeps one screen's failure from taking the whole application down with it. */
export function RouteError() {
  const error = useRouteError();

  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p>{messageForError(error)}</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}
