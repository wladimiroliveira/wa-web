export function ForbiddenPage() {
  return (
    <div className="flex flex-col gap-2 p-6">
      <h1 className="text-xl font-semibold">Acesso negado</h1>
      <p>Você não tem permissão para ver esta tela.</p>
      <p className="text-sm text-muted-foreground">Fale com quem administra o acesso se precisar dela.</p>
    </div>
  );
}
