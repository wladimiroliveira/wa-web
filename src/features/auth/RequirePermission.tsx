import { Outlet } from "react-router-dom";
import { ForbiddenPage } from "@/features/auth/ForbiddenPage";
import { hasPermission, type Permission } from "@/features/auth/permission";
import { useSession } from "@/features/auth/use-session";

interface RequirePermissionProps {
  permission: Permission;
}

/**
 * Renders 403 rather than redirecting to login. The API distinguishes "I don't
 * know who you are" from "I do, and you may not" — the screen keeps that
 * distinction instead of collapsing both into a login prompt.
 */
export function RequirePermission({ permission }: RequirePermissionProps) {
  const { data } = useSession();

  if (!data) return null;
  if (!hasPermission(data.permissions, permission)) return <ForbiddenPage />;

  return <Outlet />;
}
