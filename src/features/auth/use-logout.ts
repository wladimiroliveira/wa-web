import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { destroySession } from "@/features/auth/auth.api";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, unknown, void>({
    mutationFn: destroySession,
    // `destroySession` swallows transport failures on purpose, so this always
    // runs and the local session always ends.
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
