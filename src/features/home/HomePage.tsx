import { useSession } from "@/features/auth/use-session";

export function HomePage() {
  const { user } = useSession();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Bem-vindo, {user?.name}</h1>
      <p className="text-muted-foreground">Escolha uma opção no menu para começar.</p>
    </div>
  );
}
