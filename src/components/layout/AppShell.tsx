import { Link, NavLink, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/use-session";

export function AppShell() {
  const { user, can, signOut } = useSession();

  const destinations = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
        {/*
          `min-h-11` is the 44px touch floor. This link is hand-styled rather than a
          Button, so it inherits nothing from the component set — same reasoning as
          the nav links below.
        */}
        <Link to="/" className="flex min-h-11 items-center font-semibold">
          wa-system
        </Link>

        <nav className="flex flex-wrap gap-1">
          {destinations.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              // `min-h-11` is the 44px touch floor. These links are hand-styled rather than
              // Buttons, so they inherit nothing from the component set — and a menu is the
              // first thing a gloved hand on a tablet aims at.
              className="flex min-h-11 items-center rounded-md px-3 text-sm aria-[current=page]:bg-accent"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm">{user?.name}</span>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await signOut();
              toast.success("Sessão encerrada.");
            }}
          >
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
