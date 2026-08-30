import { Outlet } from "react-router-dom";
import { ForbiddenPage } from "@/features/auth/ForbiddenPage";
import { useSession } from "@/features/auth/use-session";
import type { Permission } from "@/lib/api";

/**
 * Renders 403 rather than redirecting to the sign-in screen. The API tells "I
 * don't know who you are" apart from "I do, and you may not"; collapsing both
 * into a login prompt would throw that distinction away and confuse the person
 * who is, in fact, signed in.
 */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { status, can } = useSession();

  if (status !== "authenticated") return null;
  if (!can(permission)) return <ForbiddenPage />;

  return <Outlet />;
}
