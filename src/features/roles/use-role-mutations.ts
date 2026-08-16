import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "@/features/auth/use-session";
import {
  createRole,
  deleteRole,
  updateRole,
  type CreateRoleInput,
  type Role,
  type UpdateRoleInput,
} from "@/features/roles/roles.api";
import { ROLES_QUERY_KEY } from "@/features/roles/use-roles";
import { USERS_QUERY_KEY } from "@/features/users/use-users";

/**
 * Coarse on purpose. Editing yourself is the case that forces it: without
 * refetching `me`, the sidebar and the route gates keep deciding by the old
 * permissions and the interface starts lying about what you may do. The cost
 * avoided would be three short, unpaginated GETs.
 */
export function useInvalidateAdminData() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateAdminData();

  return useMutation<Role, unknown, CreateRoleInput>({ mutationFn: createRole, onSuccess: invalidate });
}

export function useUpdateRole(id: string) {
  const invalidate = useInvalidateAdminData();

  return useMutation<Role, unknown, UpdateRoleInput>({
    mutationFn: (input) => updateRole(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateAdminData();

  return useMutation<void, unknown, string>({ mutationFn: deleteRole, onSuccess: invalidate });
}
