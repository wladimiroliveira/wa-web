import { useMutation } from "@tanstack/react-query";
import { useInvalidateAdminData } from "@/features/roles/use-role-mutations";
import {
  createUser,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from "@/features/users/users.api";

export function useCreateUser() {
  const invalidate = useInvalidateAdminData();

  return useMutation<User, unknown, CreateUserInput>({ mutationFn: createUser, onSuccess: invalidate });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateAdminData();

  return useMutation<User, unknown, UpdateUserInput>({
    mutationFn: (input) => updateUser(id, input),
    onSuccess: invalidate,
  });
}
