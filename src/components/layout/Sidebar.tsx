import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/auth/permission";
import { useLogout } from "@/features/auth/use-logout";
import { useSession } from "@/features/auth/use-session";

export function Sidebar() {
  const { data } = useSession();
  const logout = useLogout();

  const permissions = data?.permissions ?? [];
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(permissions, item.permission));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar p-4">
      <p className="px-2 text-sm font-semibold">wa-system</p>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-md px-2 py-1.5 text-sm ${isActive ? "bg-accent font-medium" : "text-muted-foreground"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t pt-3">
        <p className="px-2 text-sm">{data?.name}</p>
        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => logout.mutate()}>
          Sair
        </Button>
      </div>
    </aside>
  );
}
