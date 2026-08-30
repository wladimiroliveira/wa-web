import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "@/features/auth/use-session";

export function RequireSession() {
  const { status } = useSession();
  const location = useLocation();

  // Rendering nothing while the session rehydrates is deliberate: showing the
  // sign-in screen first and then yanking it away is worse than a blank instant.
  if (status === "loading") return null;

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
