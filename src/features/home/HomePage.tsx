import { useSession } from "@/features/auth/use-session";

export function HomePage() {
  const { data } = useSession();

  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">Olá, {data?.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escolha um módulo no menu ao lado para começar.</p>
    </section>
  );
}
