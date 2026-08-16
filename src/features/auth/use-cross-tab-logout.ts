import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { REFRESH_TOKEN_KEY, setAccessToken } from "@/lib/tokens";

/**
 * Propagates a logout performed in another tab.
 *
 * Rotation in another tab needs no reaction: this tab's access token stays
 * valid until it expires on its own, and the interceptor handles it then. Only
 * removal of the key means the session ended.
 */
export function useCrossTabLogout(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== REFRESH_TOKEN_KEY || event.newValue !== null) return;

      setAccessToken(null);
      queryClient.clear();
      navigate("/login", { replace: true });
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient, navigate]);
}
