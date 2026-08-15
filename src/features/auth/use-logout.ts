import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { destroySession } from "@/features/auth/auth.api";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, unknown, void>({
    mutationFn: destroySession,
    // `destroySession` swallows the failure of the revocation call itself, so a
    // dead network still lands here and the local session still ends. That is
    // the only guarantee it makes: a failure of storage itself would surface as
    // an error and skip this.
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
