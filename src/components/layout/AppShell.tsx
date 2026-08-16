import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { useCrossTabLogout } from "@/features/auth/use-cross-tab-logout";

export function AppShell() {
  useCrossTabLogout();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
