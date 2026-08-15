export function ForbiddenPage() {
  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Você está autenticado, mas não tem permissão para ver esta área. Fale com quem administra o sistema.
      </p>
    </section>
  );
}
