import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Você está autenticado, mas não tem permissão para ver esta área. Fale com quem administra o sistema.
      </p>
      {/* A user with no permission at all sees an empty sidebar: without this
          link, a bookmarked URL is a dead end. */}
      <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
        Voltar para o início
      </Link>
    </section>
  );
}
