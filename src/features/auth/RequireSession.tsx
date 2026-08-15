import { Navigate, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/features/auth/use-session";
import { getRefreshToken } from "@/lib/tokens";

export function RequireSession() {
  const location = useLocation();
  const hasStoredSession = getRefreshToken() !== null;
  const { data, isLoading, isError } = useSession();

  if (!hasStoredSession || isError) {
    // `state.from` is what sends the user back where they were headed.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading || !data) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
  }

  return <AppShell />;
}
